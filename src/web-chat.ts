import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type { AgentLoopEvent, InputInterface, InputListener, OutputContent, OutputInterface } from "@plaios/core";

import { buildOpenUIInstructions } from "./openui-prompt.js";
import type { AgentRunDto, ChatStep, OpenUIComponentSpec } from "./types.js";

interface PendingChat { chunks: string[]; run?: AgentRunDto; onDelta?: (delta: string) => void; onStep?: (step: ChatStep) => void }

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
    const push = (chunk: string) => { pending.chunks.push(chunk); pending.onDelta?.(chunk); };
    if (typeof content === "string") push(content);
    else for await (const chunk of content) push(chunk);
  }

  onRun(run: AgentRunDto): void {
    const pending = this.context.getStore();
    if (pending) pending.run = run;
  }

  onEvent(event: AgentLoopEvent): void {
    const step = toStep(event);
    if (step) this.context.getStore()?.onStep?.(step);
  }

  async ask(text: string, sessionId: string, onDelta?: (delta: string) => void, onStep?: (step: ChatStep) => void): Promise<{ text: string; capabilityIds: string[] }> {
    const listener = this.listener;
    if (!listener) throw new Error("Message runtime is not running");
    const pending: PendingChat = { chunks: [], onDelta, onStep };
    // Orchestration runs before the agent loop emits anything; discovery closes this step.
    onStep?.({ id: "plan", label: "Planning", status: "running" });
    await this.context.run(pending, () => listener({
      id: randomUUID(),
      channel: this.channel,
      sessionId,
      userId: this.userId,
      text,
      createdAt: new Date(),
      metadata: { preferredOutputChannel: this.channel },
    }));
    return { text: pending.chunks.join(""), capabilityIds: pending.run?.capabilityIds ?? [] };
  }
}

function toStep(event: AgentLoopEvent): ChatStep | undefined {
  switch (event.type) {
    case "discovery.started": return { id: "plan", label: "Planning", status: "done" };
    case "discovery.completed": return undefined;
    case "model.started": return { id: `model-${event.runId}`, label: "Thinking", status: "running" };
    case "capability.started": return { id: event.callId, label: event.capability, status: "running", detail: clip(JSON.stringify(event.arguments)) };
    case "capability.completed": return { id: event.callId, label: event.capability, status: "done" };
    case "capability.failed": return { id: event.callId, label: event.capability, status: "failed", detail: clip(event.error) };
  }
}

function clip(text: string | undefined): string | undefined {
  return text && text.length > 200 ? `${text.slice(0, 199)}…` : text;
}
