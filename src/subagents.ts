import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import type {
  AgentLoop,
  AgentLoopEvent,
  AIProcessResult,
  Capability,
  CapabilityDiscovery,
  CapabilityExecutionContext,
  CapabilityManifest,
  CapabilityResult,
  UIComponentSpec,
} from "@plaios/core/domain";

import { PLAN_ID } from "./plan.js";
import { clip } from "./web-chat.js";
import type { ChatStep } from "./types.js";

export const SUBAGENTS_ID = "plaios.subagents";
const MAX_TASKS = 4;
const MAX_TOOLS = 12;
const SUBAGENT_INSTRUCTIONS = [
  "You are a sub-agent: another agent gave you one part of a bigger task.",
  "Do it completely with your tools; do not ask questions, nobody can answer them.",
  "Finish with a short, factual report of what you did and found, with the concrete details the other agent needs.",
].join(" ");

export interface SubagentTask { title: string; task: string }
export interface SubagentsInput { tasks: SubagentTask[] }
export interface SubagentReport { title: string; ok: boolean; report: string }

/** What the host lends the capability: its live agent loop and catalog, and the chat work log. */
export interface SubagentHost {
  agentLoop(): AgentLoop | undefined;
  discovery(): CapabilityDiscovery | undefined;
  step(step: ChatStep): void;
  event(event: AgentLoopEvent, parentId: string): void;
}

const manifest: CapabilityManifest = {
  id: SUBAGENTS_ID,
  version: "1.0.0",
  name: "run_subagents",
  description: "Runs up to 4 sub-agents in parallel, each on its own self-contained task with its own tools, and returns their reports. Use it for long or multi-part work: research several topics, check several systems, or split a big job into independent parts. A sub-agent sees only its task text, not this conversation.",
  inputSchema: {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        description: "1 to 4 independent tasks.",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Short name shown to the user, e.g. \"Compare flight prices\"." },
            task: { type: "string", description: "Complete, self-contained instructions, with every detail the sub-agent needs." },
          },
          required: ["title", "task"],
          additionalProperties: false,
        },
      },
    },
    required: ["tasks"],
    additionalProperties: false,
  },
  tags: ["subagent", "agents", "parallel", "delegate", "research", "plan", "long", "complex", "multi-step"],
  execution: { timeoutMs: 30 * 60_000, idempotent: false },
};

/** Built into the host: the agent can split long work across parallel agent loops, each visible in the chat work log. */
export class SubagentsCapability implements Capability<SubagentsInput, { reports: SubagentReport[] }> {
  readonly manifest = manifest;
  private readonly depth = new AsyncLocalStorage<true>();

  constructor(private readonly host: SubagentHost) {}

  uiComponents(): readonly UIComponentSpec[] { return []; }

  docs(): string {
    return "Give each task everything it needs: the sub-agent cannot see the conversation. Tasks run at the same time, so they must not depend on each other. Sub-agents cannot start sub-agents.";
  }

  async execute(input: SubagentsInput, context: CapabilityExecutionContext): Promise<CapabilityResult<{ reports: SubagentReport[] }>> {
    if (this.depth.getStore()) return failure("NESTED_SUBAGENT", "Sub-agents cannot start sub-agents; do the work yourself.");
    const loop = this.host.agentLoop();
    if (!loop) return failure("NO_AGENT_LOOP", "The agent loop is not running.");
    const tasks = Array.isArray(input?.tasks) ? input.tasks.filter((item) => item?.task?.trim()) : [];
    if (tasks.length === 0 || tasks.length > MAX_TASKS) return failure("VALIDATION_ERROR", `Pass 1 to ${MAX_TASKS} tasks.`);
    const reports = await Promise.all(tasks.map((item, index) => this.runOne(loop, item, `${context.callId}:${index}`, context)));
    return { success: true, data: { reports } };
  }

  private async runOne(loop: AgentLoop, item: SubagentTask, id: string, context: CapabilityExecutionContext): Promise<SubagentReport> {
    const title = item.title?.trim() || item.task.trim().split("\n")[0]!.slice(0, 60);
    const base: ChatStep = { id, parentId: context.callId, kind: "agent", label: title, status: "running", detail: clip(item.task, 160), input: item.task, startedAt: new Date().toISOString() };
    this.host.step(base);
    try {
      const tools = await this.host.discovery()?.discover({ text: item.task, limit: MAX_TOOLS }) ?? [];
      const result = await this.depth.run(true, () => loop.run({
        id: randomUUID(),
        channel: "subagent",
        sessionId: `${context.sessionId ?? "subagent"}:${id}`,
        userId: context.userId,
        text: item.task,
        createdAt: new Date(),
        metadata: { instructions: SUBAGENT_INSTRUCTIONS },
      }, {
        // The chat has one checklist and one level of sub-agents.
        capabilityIds: tools.map(({ id: toolId }) => toolId).filter((toolId) => toolId !== SUBAGENTS_ID && toolId !== PLAN_ID),
        stream: false,
        signal: context.signal,
        onEvent: (event) => this.host.event(event, id),
      }));
      const report = await textOf(result);
      this.host.step({ ...base, status: "done", detail: clip(report, 160), output: report, endedAt: new Date().toISOString() });
      return { title, ok: true, report };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.host.step({ ...base, status: "failed", detail: message, output: message, endedAt: new Date().toISOString() });
      return { title, ok: false, report: message };
    }
  }
}

async function textOf(result: AIProcessResult): Promise<string> {
  if (result.type === "text") return result.text;
  let text = "";
  for await (const chunk of result.stream) text += chunk;
  return text;
}

function failure(code: string, message: string): CapabilityResult<never> {
  return { success: false, error: { code, message, retryable: false } };
}
