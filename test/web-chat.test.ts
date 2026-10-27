import assert from "node:assert/strict";
import test from "node:test";
import { WebChat } from "../src/web-chat.js";

test("correlates a chat reply and its run with the request that produced it", async () => {
  const chat = new WebChat("thomas");
  void chat.start(async (message) => {
    assert.equal(message.channel, "web");
    assert.equal(message.userId, "thomas");
    assert.match(chat.instructions, /openui-lang/);
    chat.setComponents([{ name: "CronjobList", description: "Schedules", props: [{ name: "filter", type: "string", optional: true }] }]);
    assert.match(chat.instructions, /CronjobList\(filter\?: string\)/);
    assert.match(chat.instructions, /\| Stack \| CronjobList\)/);
    await chat.write(`echo: ${message.text}`);
    chat.onRun({ at: "", channel: "web", capabilityIds: ["cronjob.manage"], durationMs: 1, ok: true });
  });
  const deltas: string[] = [];
  const [first, second] = await Promise.all([chat.ask("one", "s1", (delta) => deltas.push(delta)), chat.ask("two", "s1")]);
  assert.deepEqual(first, { text: "echo: one", capabilityIds: ["cronjob.manage"] });
  assert.deepEqual(deltas, ["echo: one"]);
  assert.equal(second.text, "echo: two");
  await chat.stop();
  await assert.rejects(chat.ask("three", "s1"), /not running/);
});
