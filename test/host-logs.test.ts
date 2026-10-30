import assert from "node:assert/strict";
import test from "node:test";
import { HostLogs } from "../src/host-logs.js";

test("tees console lines into a bounded buffer", () => {
  const printed: unknown[][] = [];
  const target = { log: (...args: unknown[]) => printed.push(args), warn: () => undefined, error: () => undefined, info: () => undefined, debug: () => undefined } as unknown as Console;
  const logs = new HostLogs();
  logs.capture(target);
  target.log("[dynamic] started %d", 3);
  target.error(new Error("boom"));
  assert.deepEqual(printed, [["[dynamic] started %d", 3]]);
  const [first, second] = logs.list();
  assert.equal(first!.text, "[dynamic] started 3");
  assert.equal(second!.level, "error");
  assert.match(second!.text, /boom/);
  for (let index = 0; index < 1_100; index += 1) logs.record("info", [index]);
  assert.equal(logs.list().length, 1_000);
});
