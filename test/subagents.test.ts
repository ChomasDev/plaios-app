import assert from "node:assert/strict";
import test from "node:test";
import type { AgentLoop, AgentLoopEvent, CapabilityDiscovery } from "@plaios/core/domain";

import { SubagentsCapability, SUBAGENTS_ID } from "../src/subagents.js";
import type { ChatStep } from "../src/types.js";

test("runs tasks in parallel as nested work-log steps and returns their reports", async () => {
  const steps: ChatStep[] = [];
  const forwarded: Array<[string, string]> = [];
  let capability: SubagentsCapability;
  const loop: AgentLoop = {
    async run(message, options) {
      assert.match(String(message.metadata?.instructions), /sub-agent/);
      assert.deepEqual(options.capabilityIds, ["web.search"]);
      await options.onEvent?.({ type: "capability.started", runId: "r", at: new Date(), callId: `c-${message.text}`, capability: "web_search", arguments: {} } as AgentLoopEvent);
      // A sub-agent asking for more sub-agents is refused.
      const nested = await capability.execute({ tasks: [{ title: "x", task: "x" }] }, { runId: "r", callId: "n", startedAt: new Date() });
      assert.equal(nested.success, false);
      if (message.text === "fail") throw new Error("boom");
      return { type: "text", text: `report ${message.text}` };
    },
  };
  const discovery = { discover: async () => [{ id: "web.search" }, { id: SUBAGENTS_ID }] } as unknown as CapabilityDiscovery;
  capability = new SubagentsCapability({
    agentLoop: () => loop,
    discovery: () => discovery,
    step: (step) => steps.push(step),
    event: (event, parentId) => forwarded.push([(event as { callId: string }).callId, parentId]),
  });
  const result = await capability.execute({ tasks: [{ title: "A", task: "a" }, { title: "B", task: "fail" }] }, { runId: "r", callId: "call", sessionId: "s", startedAt: new Date() });

  assert.equal(result.success, true);
  assert.deepEqual(result.success && result.data.reports, [
    { title: "A", ok: true, report: "report a" },
    { title: "B", ok: false, report: "boom" },
  ]);
  assert.deepEqual(forwarded.sort(), [["c-a", "call:0"], ["c-fail", "call:1"]]);
  const final = (id: string) => steps.filter((step) => step.id === id).at(-1)!;
  assert.equal(final("call:0").status, "done");
  assert.equal(final("call:0").parentId, "call");
  assert.equal(final("call:1").status, "failed");
  assert.ok(final("call:0").endedAt);
});

test("rejects an empty task list", async () => {
  const capability = new SubagentsCapability({ agentLoop: () => ({ run: async () => ({ type: "text", text: "" }) }), discovery: () => undefined, step: () => undefined, event: () => undefined });
  const result = await capability.execute({ tasks: [] }, { runId: "r", callId: "c", startedAt: new Date() });
  assert.equal(result.success, false);
});
