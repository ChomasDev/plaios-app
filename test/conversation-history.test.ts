import assert from "node:assert/strict";
import test from "node:test";
import type { InputMessage, Memory, MemoryEntry } from "@plaios/core/domain";

import { ConversationHistory } from "../src/agent-conversation-history.js";

function memoryWith(entries: MemoryEntry[]): Memory {
  return {
    async remember() {},
    async recall() {
      return entries;
    },
    async get() {
      return undefined;
    },
    async forget() {
      return false;
    },
    async clear() {
      return 0;
    },
  } as Memory;
}

function message(overrides: Partial<InputMessage> = {}): InputMessage {
  return {
    id: "input-1",
    channel: "openrouter-api",
    sessionId: "openrouter-thomas",
    userId: "thomas",
    text: "Le metti blu",
    createdAt: new Date("2026-09-18T22:00:03.000Z"),
    ...overrides,
  };
}

test("keeps the current utterance and attaches incoming last 10 turns", async () => {
  const history = new ConversationHistory(memoryWith([]));
  const turns = Array.from({ length: 12 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `turn ${index + 1}`,
  }));
  const contextualized = await history.contextualize(message({
    metadata: {
      originalText: "Le metti blu",
      conversationHistory: turns,
    },
  }));

  assert.equal(contextualized.metadata?.originalText, "Le metti blu");
  assert.deepEqual(contextualized.metadata?.conversationHistory, turns.slice(-10));
  assert.match(contextualized.text, /USER: turn 3/);
  assert.doesNotMatch(contextualized.text, /USER: turn 1\n/);
});

test("peels an OpenClaw transcript into the last user turn and prior messages", async () => {
  const history = new ConversationHistory(memoryWith([]));
  const transcript = [
    "Conversation supplied through an OpenRouter-compatible API:",
    "",
    "USER:",
    "Accendi tutte le luci in ufficio.",
    "",
    "ASSISTANT:",
    "Fatto, ho acceso led ufficio e Luce ufficio.",
    "",
    "USER:",
    "Le metti blu.",
  ].join("\n");
  const contextualized = await history.contextualize(message({
    text: transcript,
    metadata: { originalText: transcript },
  }));

  assert.equal(contextualized.metadata?.originalText, "Le metti blu.");
  assert.deepEqual(contextualized.metadata?.conversationHistory, [
    { role: "user", content: "Accendi tutte le luci in ufficio." },
    { role: "assistant", content: "Fatto, ho acceso led ufficio e Luce ufficio." },
  ]);
});

test("stores a protocol remember phrase and confirms it", async () => {
  const stored: unknown[] = [];
  const history = new ConversationHistory({
    async remember(entry) {
      stored.push(entry);
    },
    async upsertNode(node: Record<string, unknown>) {
      stored.push(node);
      return node;
    },
    async recall() {
      return [];
    },
    async get() {
      return undefined;
    },
    async forget() {
      return false;
    },
    async clear() {
      return 0;
    },
  } as Memory);

  const contextualized = await history.contextualize(message({
    text: 'ricorda che quando dico "protocollo agentos" devi aprire sul mac agentos che è al ip http://100.103.217.8:3100',
  }));

  assert.equal(contextualized.metadata?.protocolRemembered, true);
  assert.equal(contextualized.metadata?.protocolTrigger, "protocollo agentos");
  assert.match(String(contextualized.metadata?.protocolConfirmation), /100\.103\.217\.8:3100/);
  assert.ok(stored.some((item) => isRecord(item) && item.type === "protocol"));
});

test("expands a matching protocol before the orchestrator runs", async () => {
  const history = new ConversationHistory({
    async remember() {},
    async listNodes() {
      return [{
        type: "protocol",
        label: "protocollo agentos",
        data: {
          trigger: "protocollo agentos",
          expansion: "Apri http://100.103.217.8:3100 sul Mac",
          url: "http://100.103.217.8:3100",
        },
      }];
    },
    async recall() {
      return [];
    },
    async get() {
      return undefined;
    },
    async forget() {
      return false;
    },
    async clear() {
      return 0;
    },
  } as Memory);

  const contextualized = await history.contextualize(message({
    text: "protocollo agentos",
  }));

  assert.equal(contextualized.metadata?.originalText, "Apri http://100.103.217.8:3100 sul Mac");
  assert.equal(contextualized.metadata?.protocolTrigger, "protocollo agentos");
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

test("a reply in another session sees the recent proactive question", async () => {
  const asked: MemoryEntry = {
    id: "chat-assistant-cron",
    kind: "working",
    content: "Vuoi che spenga la luce?",
    createdAt: new Date("2026-09-18T21:55:00.000Z"),
    userId: "thomas",
    sessionId: "pattern-lights",
    metadata: { namespace: "chat-history", role: "assistant", proactive: true },
  };
  const stale: MemoryEntry = { ...asked, id: "old", content: "Old question", createdAt: new Date("2026-09-17T21:55:00.000Z") };
  const memory = memoryWith([]);
  memory.recall = async (query) => query?.metadata?.proactive === true ? [asked, stale] : [];
  const contextualized = await new ConversationHistory(memory).contextualize(message({ text: "sì" }));

  assert.match(contextualized.text, /ASSISTANT: Vuoi che spenga la luce\?/);
  assert.doesNotMatch(contextualized.text, /Old question/);
});
