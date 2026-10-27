import assert from "node:assert/strict";
import test from "node:test";

import { ignoredSingletons } from "../src/runtime.js";

test("warns when a second memory, orchestrator or agent loop would be ignored", () => {
  assert.deepEqual(ignoredSingletons([
    { kind: "memory", instanceId: "memory:graph" },
    { kind: "memory", instanceId: "memory:sqlite" },
    { kind: "orchestrator", instanceId: "orchestrator:default" },
    { kind: "action", instanceId: "action:cli" },
    { kind: "action", instanceId: "action:ssh" },
  ]), ["Only one memory is used: memory:graph is active, memory:sqlite ignored"]);
});
