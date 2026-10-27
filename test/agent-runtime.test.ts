import assert from "node:assert/strict";
import test from "node:test";
import type {
  AgentLoop,
  InputListener,
  InputMessage,
  Memory,
  MemoryEntry,
  Orchestrator,
  OutputInterface,
} from "@agent-os/core";

import { AgentRuntime } from "../src/agent-runtime.js";
import { Telemetry } from "../src/telemetry.js";
import type { AgentRunDto } from "../src/types.js";

function createHarness(orchestrator: Orchestrator, agentLoop: AgentLoop, onRun?: (run: AgentRunDto) => void) {
  let listener: InputListener | undefined;
  let stopInput!: () => void;
  const stopped = new Promise<void>((resolve) => { stopInput = resolve; });
  const remembered: MemoryEntry[] = [];
  const written: string[] = [];
  const input = {
    channel: "openrouter-api",
    start(next: InputListener) { listener = next; return stopped; },
    async stop() { stopInput(); },
  };
  const output: OutputInterface = {
    channel: "openrouter-api",
    async write(content) {
      if (typeof content === "string") written.push(content);
      else for await (const chunk of content) written.push(chunk);
    },
  };
  const memory = {
    async remember(entry: MemoryEntry) { remembered.push(entry); },
    async recall() { return []; },
    async get() { return undefined; },
    async forget() { return false; },
    async clear() { return 0; },
  } as Memory;
  const runtime = new AgentRuntime({ inputs: [input], outputs: [output], memory, orchestrator, agentLoop, onRun });
  return { runtime, getListener: () => listener, written, remembered, stopInput };
}

test("routes an input through memory, orchestrator, agent loop, and correlated output", async () => {
  const { runtime, getListener, written, remembered } = createHarness(
    { async orchestrate() { return { capabilityIds: [], outputChannel: "openrouter-api" }; } } as Orchestrator,
    { async run() { return { type: "text" as const, text: "hello from AgentOS" }; } } as AgentLoop,
  );
  runtime.start();
  await new Promise<void>((resolve) => setImmediate(resolve));
  const listener = getListener();
  assert.ok(listener);
  const message: InputMessage = { id: "request-1", channel: "openrouter-api", sessionId: "session-1", userId: "user-1", text: "hello", createdAt: new Date() };
  await listener(message);
  assert.deepEqual(written, ["hello from AgentOS"]);
  assert.equal(remembered.length, 2);
  assert.equal(remembered[0]?.metadata?.role, "user");
  assert.equal(remembered[1]?.metadata?.role, "assistant");
  await runtime.stop();
});

test("forwards bypassModel from the orchestrator to the agent loop", async () => {
  const { runtime, getListener, written } = createHarness(
    {
      async orchestrate() {
        return { capabilityIds: ["home-assistant.jev"], outputChannel: "openrouter-api", bypassModel: true };
      },
    } as Orchestrator,
    {
      async run(_message, options) {
        assert.equal(options.bypassModel, true);
        assert.deepEqual(options.capabilityIds, ["home-assistant.jev"]);
        return { type: "text" as const, text: "Turned off Office." };
      },
    } as AgentLoop,
  );
  runtime.start();
  await new Promise<void>((resolve) => setImmediate(resolve));
  const listener = getListener();
  assert.ok(listener);
  await listener({
    id: "request-2",
    channel: "openrouter-api",
    sessionId: "session-1",
    text: "turn off all the lights in the office",
    createdAt: new Date(),
  });
  assert.deepEqual(written, ["Turned off Office."]);
  await runtime.stop();
});

test("confirms a remembered protocol without calling the orchestrator", async () => {
  let orchestrated = false;
  const { runtime, getListener, written } = createHarness(
    {
      async orchestrate() {
        orchestrated = true;
        return { capabilityIds: [], outputChannel: "openrouter-api" };
      },
    } as Orchestrator,
    {
      async run() {
        return { type: "text" as const, text: "should not run" };
      },
    } as AgentLoop,
  );
  runtime.start();
  await new Promise<void>((resolve) => setImmediate(resolve));
  const listener = getListener();
  assert.ok(listener);
  await listener({
    id: "request-3",
    channel: "openrouter-api",
    sessionId: "session-1",
    userId: "user-1",
    text: 'ricorda che quando dico "protocollo agentos" devi aprire sul mac agentos che è al ip http://100.103.217.8:3100',
    createdAt: new Date(),
  });
  assert.equal(orchestrated, false);
  assert.match(written[0] ?? "", /protocollo agentos/);
  assert.match(written[0] ?? "", /100\.103\.217\.8:3100/);
  await runtime.stop();
});

test("records each run with chosen capabilities, latency and failures", async () => {
  const telemetry = new Telemetry();
  let fail = false;
  const { runtime, getListener } = createHarness(
    { async orchestrate() { return { capabilityIds: ["ssh.control"], outputChannel: "openrouter-api" }; } } as Orchestrator,
    { async run() { if (fail) throw new Error("model down"); return { type: "text" as const, text: "ok" }; } } as AgentLoop,
    (run) => telemetry.record(run),
  );
  runtime.start();
  await new Promise<void>((resolve) => setImmediate(resolve));
  const listener = getListener()!;
  const message: InputMessage = { id: "r", channel: "openrouter-api", sessionId: "s", userId: "u", text: "hi", createdAt: new Date() };
  await listener(message);
  fail = true;
  await assert.rejects(async () => listener(message), /model down/);
  const { runs } = telemetry.snapshot();
  assert.equal(runs.total, 2);
  assert.equal(runs.failed, 1);
  assert.equal(runs.recent[0]?.error, "model down");
  assert.deepEqual(runs.recent[1]?.capabilityIds, ["ssh.control"]);
  assert.equal(runs.recent[1]?.outputChannel, "openrouter-api");
  assert.ok(runs.recent[1]!.durationMs >= 0);
  await runtime.stop();
});
