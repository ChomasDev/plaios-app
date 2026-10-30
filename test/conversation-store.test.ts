import assert from "node:assert/strict";
import test from "node:test";
import type { Database, DatabaseQuery, DatabaseRecord } from "@plaios/core/domain";

import { ConversationStore, applyChatEvent, lastTurnOf, statusOf } from "../src/conversation-store.js";
import type { ChatTurnDto } from "../src/types.js";

/** Just enough of the Database contract: primary-key rows, equality filters and one sort field. */
function memoryDatabase(): Database & { tables: Map<string, Map<string, DatabaseRecord>> } {
  const tables = new Map<string, Map<string, DatabaseRecord>>();
  const table = (name: string) => tables.get(name) ?? tables.set(name, new Map()).get(name)!;
  const clone = <T>(value: T): T => structuredClone(value);
  const db = {
    namespace: "test",
    tables,
    init: async () => undefined,
    add: async (name: string, value: DatabaseRecord) => { table(name).set(String(value.id), clone(value)); return value; },
    get: async (name: string, target?: string | number | DatabaseQuery) => {
      if (typeof target === "string" || typeof target === "number") return clone(table(name).get(String(target)));
      const rows = [...table(name).values()].filter((row) => Object.entries(target?.where ?? {}).every(([key, value]) => row[key] === value));
      const [order] = target?.orderBy ?? [];
      if (order) rows.sort((left, right) => (String(left[order.field]) < String(right[order.field]) ? -1 : 1) * (order.direction === "desc" ? -1 : 1));
      return clone(rows);
    },
    set: async (name: string, id: string | number, value: DatabaseRecord) => { table(name).set(String(id), clone(value)); return value; },
    update: async (name: string, id: string | number, patch: DatabaseRecord) => {
      const current = table(name).get(String(id));
      if (!current) return undefined;
      table(name).set(String(id), { ...current, ...clone(patch) });
      return current;
    },
    delete: async () => 0,
  };
  return db as unknown as Database & { tables: Map<string, Map<string, DatabaseRecord>> };
}

test("keeps every message and step in the database, in order, and settles live turns after a restart", async () => {
  const db = memoryDatabase();
  const store = new ConversationStore(() => db);
  let turn: ChatTurnDto = { id: 2, question: "Plan my trip", components: [], streaming: true };
  turn = applyChatEvent(turn, { step: { id: "c1", label: "web_search", status: "running", input: "{}" } });
  turn = applyChatEvent(turn, { step: { id: "c1", label: "web_search", status: "done", output: "flights" } });
  turn = applyChatEvent(turn, { delta: "Here" });
  await store.saveTurn("conv-1", turn);
  await store.saveTurn("conv-1", { id: 1, question: "First", answer: "Hi", components: [] });
  await store.saveTurn("conv-2", { id: 5, question: "Never finished", components: [], streaming: true });

  const conversation = await store.get("conv-1");
  assert.deepEqual(conversation?.turns.map(({ id }) => id), [1, 2]);
  assert.equal(conversation?.title, "First");
  assert.deepEqual(conversation?.turns[1]?.steps, [{ id: "c1", label: "web_search", status: "done", input: "{}", output: "flights" }]);

  const restarted = new ConversationStore(() => db);
  assert.equal((await restarted.get("conv-1"))?.turns[1]?.streaming, undefined);
  assert.equal((await restarted.get("conv-2"))?.turns[0]?.error, "Interrupted before an answer arrived.");
  assert.deepEqual((await restarted.list()).map(({ id, turnCount }) => ({ id, turnCount })).sort((a, b) => a.id.localeCompare(b.id)), [
    { id: "conv-1", turnCount: 2 },
    { id: "conv-2", turnCount: 1 },
  ]);
});

test("imports a browser's conversations without duplicating turns or accepting unsafe ids", async () => {
  const store = new ConversationStore(() => memoryDatabase());
  const db = memoryDatabase();
  const shared = new ConversationStore(() => db);
  await shared.saveTurn("a", { id: 1, question: "one", answer: "server", components: [] });
  const imported = await shared.import([
    { id: "a", title: "", startedAt: "", updatedAt: "", turns: [{ id: 1, question: "one", answer: "browser", components: [] }, { id: 2, question: "two", components: [] }] },
    { id: "../evil", title: "", startedAt: "", updatedAt: "", turns: [{ id: 1, question: "x", components: [] }] },
  ]);
  assert.equal(imported, 1);
  assert.deepEqual((await shared.get("a"))?.turns.map(({ id, answer }) => ({ id, answer })), [{ id: 1, answer: "server" }, { id: 2, answer: undefined }]);
  await assert.rejects(store.saveTurn("../evil", { id: 1, question: "x", components: [] }));
  await assert.rejects(new ConversationStore(() => undefined).list(), /database component/);
});

test("sidebar status follows T3 Code: working, awaiting input, then unseen failures and completions", () => {
  const at = new Date("2026-10-30T10:00:00Z");
  const later = new Date("2026-10-30T10:05:00Z");
  assert.equal(statusOf({ lastTurn: "working", updatedAt: at, lastVisitedAt: later }), "working");
  assert.equal(statusOf({ lastTurn: "asked", updatedAt: at, lastVisitedAt: later }), "awaiting-input");
  assert.equal(statusOf({ lastTurn: "failed", updatedAt: later, lastVisitedAt: at }), "failed");
  assert.equal(statusOf({ lastTurn: "answered", updatedAt: later, lastVisitedAt: at }), "completed");
  assert.equal(statusOf({ lastTurn: "answered", updatedAt: at, lastVisitedAt: later }), null);
  assert.equal(statusOf({ lastTurn: "answered", updatedAt: at, lastVisitedAt: null }), null);
  assert.equal(lastTurnOf({ id: 1, question: "q", answer: "Fatto.\n\nVuoi che spenga anche la cucina?", components: [] }), "asked");
  assert.equal(lastTurnOf({ id: 1, question: "q", answer: "Is it? No, it's done.", components: [] }), "answered");
});

test("folds an error and the final event into the turn", () => {
  const base: ChatTurnDto = { id: 1, question: "q", components: [], streaming: true };
  assert.deepEqual(applyChatEvent(base, { done: true, components: ["action:x"] }), { ...base, answer: "", components: ["action:x"], streaming: false });
  assert.deepEqual(applyChatEvent(base, { error: "boom" }), { ...base, error: "boom", streaming: false });
});

test("keeps a message's attachments in their own table, in order", async () => {
  const db = memoryDatabase();
  const store = new ConversationStore(() => db);
  const files = [{ id: "u1", name: "photo.png", mediaType: "image/png", size: 10 }, { id: "u2", name: "notes.txt", mediaType: "text/plain", size: 5 }];
  await store.saveTurn("c", { id: 1, question: "", attachments: files, components: [], streaming: true });
  await store.saveTurn("c", { id: 1, question: "", attachments: files, answer: "ok", components: [] });
  const conversation = await store.get("c");
  assert.deepEqual(conversation?.turns[0]?.attachments, files);
  assert.equal(conversation?.title, "Attachment");
  assert.equal(db.tables.get("attachments")?.size, 2);
});
