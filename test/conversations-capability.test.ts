import assert from "node:assert/strict";
import test from "node:test";
import type { Memory, MemoryEntry, MemoryQuery } from "@plaios/core/domain";

import { ConversationsCapability } from "../src/conversations-capability.js";

const entry = (id: string, sessionId: string, role: string, content: string, minute: number, channel = "web"): MemoryEntry => ({
  id, kind: "working", content, sessionId, createdAt: new Date(Date.UTC(2026, 9, 30, 10, minute)), metadata: { namespace: "chat-history", role, channel },
});

test("lists conversations of every channel and reads one oldest first", async () => {
  const entries = [
    entry("4", "tg-1", "assistant", "Done", 4, "telegram"),
    entry("3", "tg-1", "user", "Spegni la luce", 3, "telegram"),
    entry("2", "web-1", "assistant", "Rome is nice", 2),
    entry("1", "web-1", "user", "Plan a trip to Rome", 1),
  ];
  const queries: MemoryQuery[] = [];
  const memory = { recall: async (query: MemoryQuery) => { queries.push(query); return query.sessionId ? entries.filter(({ sessionId }) => sessionId === query.sessionId) : entries; } } as unknown as Memory;
  const capability = new ConversationsCapability(() => memory);

  const list = await capability.execute({ action: "list", sessionId: null, query: null });
  assert.ok(list.success);
  assert.match(list.data.text, /tg-1 · telegram · 2026-10-30 10:04 · 2 message\(s\) · "Spegni la luce"/);
  assert.match(list.data.text, /web-1 · web .* "Plan a trip to Rome"/);

  const read = await capability.execute({ action: "read", sessionId: "web-1", query: null });
  assert.ok(read.success);
  assert.match(read.data.text, /USER: Plan a trip to Rome\n.*ASSISTANT: Rome is nice/);
  assert.equal(queries.at(-1)?.metadata?.namespace, "chat-history");

  assert.equal((await capability.execute({ action: "read", sessionId: null, query: null })).success, false);
  assert.equal((await new ConversationsCapability(() => undefined).execute({ action: "list", sessionId: null, query: null })).success, false);
});
