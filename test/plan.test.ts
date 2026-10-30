import assert from "node:assert/strict";
import test from "node:test";

import { PlanCapability } from "../src/plan.js";
import type { ChatStep } from "../src/types.js";

test("shows the checklist as one work-log step and drops invalid items", async () => {
  const steps: ChatStep[] = [];
  const plan = new PlanCapability((step) => steps.push(step));
  const result = await plan.execute({ items: [{ text: "Find flights", status: "done" }, { text: " Book hotel ", status: "in_progress" }, { text: "", status: "pending" }] });
  assert.deepEqual(result, { success: true, data: { items: 2, done: 1 } });
  assert.deepEqual(steps, [{ id: "todo", kind: "todo", label: "Plan", status: "running", detail: "1/2", items: [{ text: "Find flights", status: "done" }, { text: "Book hotel", status: "in_progress" }] }]);
  assert.equal((await plan.execute({ items: [] })).success, false);
});
