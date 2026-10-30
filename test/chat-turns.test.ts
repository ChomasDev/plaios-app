import assert from "node:assert/strict";
import test from "node:test";
import { ChatTurns, type ChatEvent } from "../src/chat-turns.js";

test("a chat turn outlives its follower and replays to a new one", async () => {
  const turns = new ChatTurns();
  let emit!: (event: ChatEvent) => void;
  turns.start("t1", (push) => new Promise<void>((resolve) => { emit = (event) => { push(event); if (event.done) resolve(); }; }));
  turns.start("t1", async () => assert.fail("a turn starts once"));
  const first: ChatEvent[] = [];
  const leave = turns.follow("t1", (event) => first.push(event));
  emit({ step: { id: "plan", label: "Planning", status: "running" } });
  leave?.();
  emit({ delta: "hi" });
  const second: ChatEvent[] = [];
  turns.follow("t1", (event) => second.push(event));
  emit({ done: true, components: [] });
  assert.equal(first.length, 1);
  assert.deepEqual(second.map((event) => Object.keys(event)[0]), ["step", "delta", "done"]);
  assert.equal(turns.follow("missing", () => undefined), undefined);
});

test("a failing turn ends with an error event", async () => {
  const turns = new ChatTurns();
  turns.start("t2", async () => { throw new Error("boom"); });
  await new Promise((resolve) => setImmediate(resolve));
  const events: ChatEvent[] = [];
  turns.follow("t2", (event) => events.push(event));
  assert.deepEqual(events, [{ error: "boom" }]);
});
