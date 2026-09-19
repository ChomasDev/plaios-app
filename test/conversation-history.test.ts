import assert from "node:assert/strict";
import test from "node:test";
import type { InputMessage, Memory, MemoryEntry } from "@agent-os/core/domain";

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
