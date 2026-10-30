import assert from "node:assert/strict";
import test from "node:test";
import { WebChat } from "../src/web-chat.js";
import type { ChatStep } from "../src/types.js";
import { mergeStep } from "../src/conversation-store.js";

test("correlates a chat reply and its run with the request that produced it", async () => {
  const chat = new WebChat("thomas");
  void chat.start(async (message) => {
    assert.equal(message.channel, "web");
    assert.equal(message.userId, "thomas");
    assert.match(chat.instructions, /openui-lang/);
    chat.setComponents([{ name: "CronjobList", description: "Schedules", props: [{ name: "filter", type: "string", optional: true }] }]);
    assert.match(chat.instructions, /CronjobList\(filter\?: string\)/);
    assert.match(chat.instructions, /\| Stack \| CronjobList\)/);
    chat.onEvent({ type: "capability.started", runId: "r", at: new Date(), callId: "c1", capability: "t3code", arguments: { q: 1 } });
    await chat.write(`echo: ${message.text}`);
    chat.onRun({ at: "", channel: "web", capabilityIds: ["cronjob.manage"], durationMs: 1, ok: true });
  });
  const deltas: string[] = [];
  const steps: ChatStep[] = [];
  const [first, second] = await Promise.all([chat.ask("one", "s1", (delta) => deltas.push(delta), (step) => steps.push(step)), chat.ask("two", "s1")]);
  assert.deepEqual(steps.map(({ startedAt: _, ...step }) => step), [
    { id: "plan", kind: "plan", label: "Planning", status: "running" },
    { id: "c1", kind: "tool", label: "t3code", status: "running", detail: '{ "q": 1 }', input: '{\n  "q": 1\n}' },
  ]);
  assert.deepEqual(first, { text: "echo: one", capabilityIds: ["cronjob.manage"] });
  assert.deepEqual(deltas, ["echo: one"]);
  assert.equal(second.text, "echo: two");
  await chat.stop();
  await assert.rejects(chat.ask("three", "s1"), /not running/);
});

test("nests sub-agent events under their step and keeps the chat's own planning line", async () => {
  const chat = new WebChat();
  void chat.start(async () => {
    chat.onEvent({ type: "discovery.started", runId: "sub", at: new Date(), query: "x" }, "call:0");
    chat.onEvent({ type: "capability.completed", runId: "sub", at: new Date(), callId: "c2", capability: "web_search", result: { success: false, error: { message: "quota" } } }, "call:0");
    await chat.write("ok");
  });
  const steps: ChatStep[] = [];
  await chat.ask("go", "s", undefined, (step) => steps.push(step));
  assert.deepEqual(steps.map(({ id, parentId, status, detail }) => ({ id, parentId, status, detail })), [
    { id: "plan", parentId: undefined, status: "running", detail: undefined },
    { id: "c2", parentId: "call:0", status: "failed", detail: "quota" },
  ]);
});

test("streams the model's thinking as one growing line that the next action closes", async () => {
  const chat = new WebChat();
  void chat.start(async () => {
    chat.onEvent({ type: "model.reasoning", runId: "r", at: new Date(), delta: "Look " });
    chat.onEvent({ type: "model.reasoning", runId: "r", at: new Date(), delta: "at files" });
    chat.onEvent({ type: "capability.started", runId: "r", at: new Date(), callId: "c1", capability: "run_cli_command", arguments: { command: "ls" } });
    chat.onEvent({ type: "model.reasoning", runId: "r", at: new Date(), delta: "Done" });
    await chat.write("ok");
  });
  const steps: ChatStep[] = [];
  await chat.ask("go", "s", undefined, (step) => steps.push(step));
  const merged = steps.reduce(mergeStep, [] as ChatStep[]);
  assert.deepEqual(merged.map(({ id, kind, status, output }) => ({ id, kind, status, output })), [
    { id: "plan", kind: "plan", status: "running", output: undefined },
    { id: "thought-1", kind: "thought", status: "done", output: "Look at files" },
    { id: "c1", kind: "tool", status: "running", output: undefined },
    { id: "thought-2", kind: "thought", status: "done", output: "Done" },
  ]);
});
