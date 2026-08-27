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

test("routes an input through memory, orchestrator, agent loop, and correlated output", async () => {
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
  const orchestrator = {
    async orchestrate() { return { capabilityIds: [], outputChannel: "openrouter-api" }; },
  } as Orchestrator;
  const agentLoop = {
    async run() { return { type: "text" as const, text: "hello from AgentOS" }; },
  } as AgentLoop;
  const runtime = new AgentRuntime({ inputs: [input], outputs: [output], memory, orchestrator, agentLoop });
  runtime.start();
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.ok(listener);
  const message: InputMessage = { id: "request-1", channel: "openrouter-api", sessionId: "session-1", userId: "user-1", text: "hello", createdAt: new Date() };
  await listener(message);
  assert.deepEqual(written, ["hello from AgentOS"]);
  assert.equal(remembered.length, 2);
  assert.equal(remembered[0]?.metadata?.role, "user");
  assert.equal(remembered[1]?.metadata?.role, "assistant");
  await runtime.stop();
});
