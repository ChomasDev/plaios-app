import assert from "node:assert/strict";
import test from "node:test";
import type { InputMessage, Memory, MemoryEntry, MemoryQuery } from "@plaios/core/domain";
import { renderContextMemory, selectContextMemories } from "../src/agent-memory-context.js";

const long = "parola ".repeat(400);
const message = { id: "m", userId: "thomas", sessionId: "s" } as InputMessage;

function entry(id: string, content: string, metadata: Record<string, unknown> = {}): MemoryEntry {
  return { id, kind: "episodic", content, createdAt: new Date("2026-08-10"), metadata };
}

test("context memories are short, varied and capped per story", async () => {
  const story = Array.from({ length: 30 }, (_, index) =>
    entry(`life-${index}`, `${long} scena ${index}`, { narrativeArc: "Alessia", sourceRefs: [{ document: "serie.docx" }] }));
  const reinforced: string[] = [];
  const memory = {
    async recall(query: MemoryQuery) {
      if (query.kinds?.includes("working")) return [];
      return query.text ? [...story, entry("fact", "Valentina Brisolin e amica di Alex", { namespace: "user-memory" })] : [];
    },
    async reinforce(ids: readonly string[]) {
      reinforced.push(...ids);
    },
  } as unknown as Memory;
  const picked = await selectContextMemories(memory, message, "Valentina");
  assert.ok(picked.filter(({ metadata }) => metadata?.narrativeArc === "Alessia").length <= 3);
  assert.ok(picked.some(({ id }) => id === "fact"));
  assert.deepEqual(reinforced, picked.map(({ id }) => id));
  const rendered = renderContextMemory(picked[0]!);
  assert.ok(rendered.length < 650);
  assert.match(rendered, /excerpt of \d+ chars; memory_retrieval id/);
});

test("a nickname finds the person node and its graph neighbours", async () => {
  const memory = {
    async recall() {
      return [];
    },
    async listNodes() {
      return [{ id: "entity-v", type: "people", label: "Valentina", data: { aliases: ["Vale"] }, metadata: {}, createdAt: new Date(), weight: 1 }];
    },
    async neighbors() {
      return [{ id: "entity-a", type: "people", label: "Alex" }, { id: "chat-1", type: "memory", label: "..." }];
    },
  } as unknown as Memory;
  const [first] = await selectContextMemories(memory, message, "cosa sai sulla vale?");
  assert.equal(first?.id, "entity-v");
  assert.deepEqual((first?.content as { related?: unknown }).related, ["Alex (people)"]);
});
