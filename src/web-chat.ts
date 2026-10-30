import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { AgentLoopEvent, InputAttachment, InputInterface, InputListener, OutputContent, OutputInterface } from "@plaios/core";

import { buildOpenUIInstructions } from "./openui-prompt.js";
import type { AgentRunDto, ChatStep, OpenUIComponentSpec } from "./types.js";

interface PendingChat {
  chunks: string[];
  run?: AgentRunDto;
  onDelta?: (delta: string) => void;
  onStep?: (step: ChatStep) => void;
  /** The thought still being written, per agent (`""` for the chat's own); the next action closes it. */
  thoughts: Map<string, string>;
  thoughtCount: number;
}

/** Chat channel of the control plane UI. Each request runs in its own async context so concurrent chats stay correlated. */
export class WebChat implements InputInterface, OutputInterface {
  readonly channel = "web" as const;
  readonly description = "The PLAIOS web UI chat that originated this message";
  private components: readonly OpenUIComponentSpec[] = [];
  private prompt = buildOpenUIInstructions();

  /** Formatting rules for this channel: OpenUI Lang plus whatever components the installed plugins expose. */
  get instructions(): string { return this.prompt; }

  setComponents(components: readonly OpenUIComponentSpec[]): void {
    if (JSON.stringify(components) === JSON.stringify(this.components)) return;
    this.components = components;
    this.prompt = buildOpenUIInstructions(components);
  }
  private readonly context = new AsyncLocalStorage<PendingChat>();
  private listener?: InputListener;
  private resolveStopped?: () => void;

  constructor(private readonly userId?: string) {}

  async start(listener: InputListener): Promise<void> {
    this.listener = listener;
    await new Promise<void>((resolve) => { this.resolveStopped = resolve; });
  }

  async stop(): Promise<void> {
    this.listener = undefined;
    this.resolveStopped?.();
  }

  async write(content: OutputContent): Promise<void> {
    const pending = this.context.getStore();
    if (!pending) throw new Error("WebChat.write must run inside an active chat request");
    // The answer starting ends the chat's own thinking.
    this.closeThought();
    const push = (chunk: string) => { pending.chunks.push(chunk); pending.onDelta?.(chunk); };
    if (typeof content === "string") push(content);
    else for await (const chunk of content) push(chunk);
  }

  onRun(run: AgentRunDto): void {
    const pending = this.context.getStore();
    if (pending) pending.run = run;
  }

  /** Loop events of the current chat; a sub-agent's events carry the step they nest under. */
  onEvent(event: AgentLoopEvent, parentId?: string): void {
    if (event.type === "model.reasoning") return this.think(event.delta, parentId);
    this.closeThought(parentId);
    // The plan tool draws its own checklist; a line per update would only repeat it.
    if ("capability" in event && event.capability === "update_plan") return;
    const step = toStep(event);
    if (!step) return;
    if (!parentId) return this.step(step);
    // A sub-agent's own planning would overwrite the chat's planning line.
    if (step.kind !== "plan") this.step({ ...step, parentId });
  }

  step(step: ChatStep): void {
    this.context.getStore()?.onStep?.(step);
  }

  /** Grows the current thought line, or starts one after an action. */
  private think(delta: string, parentId?: string): void {
    const pending = this.context.getStore();
    if (!pending || !delta) return;
    const key = parentId ?? "";
    let id = pending.thoughts.get(key);
    const first = !id;
    if (!id) {
      id = `thought-${pending.thoughtCount += 1}`;
      pending.thoughts.set(key, id);
    }
    this.step({ id, kind: "thought", label: "Thought", status: "running", delta, ...(first ? { startedAt: new Date().toISOString(), ...(parentId ? { parentId } : {}) } : {}) });
  }

  private closeThought(parentId?: string): void {
    const pending = this.context.getStore();
    const id = pending?.thoughts.get(parentId ?? "");
    if (!pending || !id) return;
    pending.thoughts.delete(parentId ?? "");
    this.step({ id, kind: "thought", label: "Thought", status: "done", endedAt: new Date().toISOString() });
  }

  /** `input` carries attachments: images for the model, and the text the history keeps instead of inlined files. */
  async ask(text: string, sessionId: string, onDelta?: (delta: string) => void, onStep?: (step: ChatStep) => void, input: { attachments?: InputAttachment[]; originalText?: string } = {}): Promise<{ text: string; capabilityIds: string[] }> {
    const listener = this.listener;
    if (!listener) throw new Error("Message runtime is not running");
    const pending: PendingChat = { chunks: [], onDelta, onStep, thoughts: new Map(), thoughtCount: 0 };
    // Orchestration runs before the agent loop emits anything; discovery closes this step.
    onStep?.({ id: "plan", kind: "plan", label: "Planning", status: "running", startedAt: new Date().toISOString() });
    await this.context.run(pending, () => listener({
      id: randomUUID(),
      channel: this.channel,
      sessionId,
      userId: this.userId,
      text,
      ...(input.attachments?.length ? { attachments: input.attachments } : {}),
      createdAt: new Date(),
      metadata: { preferredOutputChannel: this.channel, ...(input.originalText ? { originalText: input.originalText } : {}) },
    }));
    return { text: pending.chunks.join(""), capabilityIds: pending.run?.capabilityIds ?? [] };
  }
}

const PREVIEW = 160;
const FULL = 4_000;

function toStep(event: AgentLoopEvent): ChatStep | undefined {
  const at = event.at.toISOString();
  switch (event.type) {
    case "discovery.started": return { id: "plan", kind: "plan", label: "Planning", status: "done", endedAt: at };
    case "capability.started": {
      const input = pretty(event.arguments);
      return { id: event.callId, kind: "tool", label: event.capability, status: "running", detail: clip(oneLine(input), PREVIEW), input: clip(input, FULL), startedAt: at };
    }
    case "capability.completed": {
      const result = event.result as { success?: boolean; data?: unknown; error?: { message?: string } } | undefined;
      const failed = result?.success === false;
      const output = pretty(failed ? result?.error : result?.data ?? result);
      return { id: event.callId, kind: "tool", label: event.capability, status: failed ? "failed" : "done", ...(failed ? { detail: clip(result?.error?.message ?? output, PREVIEW) } : {}), output: clip(output, FULL), endedAt: at };
    }
    case "capability.failed": return { id: event.callId, kind: "tool", label: event.capability, status: "failed", detail: clip(event.error, PREVIEW), output: clip(event.error, FULL), endedAt: at };
    // The model's own turns show as the work log's "Thinking" header, not as lines.
    default: return undefined;
  }
}

function pretty(value: unknown): string {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value, null, 2) ?? String(value); } catch { return String(value); }
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function clip(text: string | undefined, max = 200): string | undefined {
  return text && text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
