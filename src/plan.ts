import type { Capability, CapabilityManifest, CapabilityResult, UIComponentSpec } from "@plaios/core/domain";

import type { ChatStep, PlanItem } from "./types.js";

export const PLAN_ID = "plaios.plan";
const STATUSES: readonly PlanItem["status"][] = ["pending", "in_progress", "done"];

const manifest: CapabilityManifest = {
  id: PLAN_ID,
  version: "1.0.0",
  name: "update_plan",
  description: "Shows the user your checklist for a task with three or more steps. Call it once with every step at the start, then again whenever a step starts or finishes, always passing the whole list. Skip it for quick requests.",
  inputSchema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string", description: "The step, short and concrete." },
            status: { type: "string", enum: [...STATUSES] },
          },
          required: ["text", "status"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
  tags: ["plan", "todo", "checklist", "steps", "progress"],
  execution: { timeoutMs: 5_000, idempotent: true },
};

/** Built into the host: the agent's checklist, pinned at the top of the chat work log. */
export class PlanCapability implements Capability<{ items: PlanItem[] }, { items: number; done: number }> {
  readonly manifest = manifest;

  constructor(private readonly step: (step: ChatStep) => void) {}

  uiComponents(): readonly UIComponentSpec[] { return []; }

  docs(): string { return "Exactly one step should be in_progress while you work. The list only informs the user; it changes nothing by itself."; }

  async execute(input: { items: PlanItem[] }): Promise<CapabilityResult<{ items: number; done: number }>> {
    const items = Array.isArray(input?.items)
      ? input.items.filter((item) => item?.text?.trim() && STATUSES.includes(item.status)).map(({ text, status }) => ({ text: text.trim(), status }))
      : [];
    if (items.length === 0) return { success: false, error: { code: "VALIDATION_ERROR", message: "Pass at least one item with text and status.", retryable: false } };
    const done = items.filter(({ status }) => status === "done").length;
    this.step({ id: "todo", kind: "todo", label: "Plan", status: done === items.length ? "done" : "running", detail: `${done}/${items.length}`, items });
    return { success: true, data: { items: items.length, done } };
  }
}
