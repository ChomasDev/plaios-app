import { randomUUID } from "node:crypto";
import type {
  InputMessage,
  Memory,
  MemoryProposal,
} from "@plaios/core/domain";

export async function persistMemoryProposals(
  memory: Memory,
  message: InputMessage,
  proposals: readonly MemoryProposal[] = [],
): Promise<void> {
  if (!message.userId) return;
  for (const proposal of proposals) {
    if (proposal.operation !== "remember") continue;
    const content = renderContent(proposal.content);
    if (await alreadyRemembered(memory, message, proposal.kind, content)) continue;
    const addedMemoryDate = new Date();
    await memory.remember({
      id: `user-memory-${randomUUID()}`,
      kind: proposal.kind,
      content,
      createdAt: addedMemoryDate,
      addedMemoryDate,
      factDate: proposal.factDate,
      userId: message.userId,
      confidence: proposal.confidence,
      metadata: {
        namespace: "user-memory",
        reason: proposal.reason,
        sourceChannel: message.channel,
        sourceMessageId: message.id,
        // People named by the proposal become (or reuse) graph entities linked to this memory.
        ...(Array.isArray(entitiesOf(proposal)) ? { entities: entitiesOf(proposal) } : {}),
      },
    });
    console.log(`Added memory: ${content}`);
  }
}

async function alreadyRemembered(
  memory: Memory,
  message: InputMessage,
  kind: "semantic" | "episodic" | "procedural" | "working",
  content: string,
): Promise<boolean> {
  const matches = await memory.recall({
    kinds: [kind],
    text: content,
    userId: message.userId,
    limit: 10,
  });
  const tokens = tokenSet(content);
  return matches.some((entry) => similarity(tokenSet(renderContent(entry.content)), tokens) >= NEAR_DUPLICATE);
}

/** The same fact told twice ("la Vale" one day, "Valentina" the next) differs in a word or two. */
const NEAR_DUPLICATE = 0.8;

function entitiesOf(proposal: MemoryProposal): unknown {
  return (proposal as { entities?: unknown }).entities;
}

function tokenSet(text: string): Set<string> {
  return new Set(text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
}

function similarity(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function renderContent(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}
