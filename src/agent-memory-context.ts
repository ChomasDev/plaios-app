import type { InputMessage, Memory, MemoryEntry, MemoryQuery } from "@plaios/core/domain";

const CHAT_NAMESPACE = "chat-history";
const LONG_TERM_KINDS = ["semantic", "episodic", "procedural"] as const;
const RELEVANT_POOL = 100;
const RECENT_POOL = 25;
const STABLE_POOL = 80;
const CHAT_POOL = 20;
/** Many short, varied memories beat a few huge ones: relevance first, then recency, stable facts and past chats. */
const SLOTS = { entity: 4, relevant: 13, recent: 4, stable: 3, chat: 3 };
const MAX_MEMORIES = 22;
const MAX_PER_PARENT = 2;
const MAX_RELATED = 12;
/** Recency and stable-fact slots should not all be, say, projects saved in the same batch. */
const MAX_PER_TYPE_OUTSIDE_RELEVANCE = 2;
/** Caps per story arc and per imported document, so one manuscript cannot fill the context. */
const GROUP_CAPS = { arc: 3, namedArc: 6, document: 8 };
const MAX_ITEM_CHARS = 420;
const CHAR_BUDGET = 9_000;
const NEAR_DUPLICATE = 0.6;
const MIN_STABLE_CHARS = 60;

type Slot = keyof typeof SLOTS;

interface GraphNodeLike {
  id: string;
  type: string;
  label: string;
  data?: unknown;
  metadata?: Record<string, unknown>;
  kind?: MemoryEntry["kind"];
  weight?: number;
  userId?: string;
  createdAt: Date;
  addedMemoryDate?: Date;
}

/** Optional graph-memory extras; any Memory works without them. */
interface GraphMemoryExtras {
  reinforce?(ids: readonly string[]): Promise<void>;
  listNodes?(query?: { userId?: string }): Promise<readonly GraphNodeLike[]>;
  neighbors?(id: string, depth?: number): Promise<readonly GraphNodeLike[]>;
}

type ContextMemory = Memory & GraphMemoryExtras;

/**
 * Picks the memories injected before every request. Candidates are over-fetched
 * without reinforcement; only the kept ones count as accessed.
 */
export async function selectContextMemories(
  memory: Memory,
  message: InputMessage,
  text: string,
): Promise<MemoryEntry[]> {
  if (!message.userId) return [];
  const graph = memory as ContextMemory;
  const base = { userId: message.userId, reinforce: false } as MemoryQuery;
  const [relevant, recentSemantic, recentEpisodic, stable, chats] = await Promise.all([
    memory.recall({ ...base, text, kinds: [...LONG_TERM_KINDS], limit: RELEVANT_POOL }),
    memory.recall({ ...base, kinds: ["semantic"], metadata: { namespace: "user-memory" }, limit: RECENT_POOL, order: "newest" }),
    memory.recall({ ...base, kinds: ["episodic"], metadata: { namespace: "user-memory" }, limit: RECENT_POOL, order: "newest" }),
    memory.recall({ ...base, kinds: ["semantic"], limit: STABLE_POOL, order: "oldest" }),
    memory.recall({ ...base, text, kinds: ["working"], metadata: { namespace: CHAT_NAMESPACE, role: "user" }, limit: CHAT_POOL }),
  ]);
  const terms = queryTerms(text);
  const selection = new Selection(terms);
  selection.fill(await namedEntities(graph, message.userId, terms), SLOTS.entity, "entity");
  selection.fill(relevant, SLOTS.relevant, "relevant");
  selection.fill(byNewest([...recentSemantic, ...recentEpisodic]).filter(isStandalone), SLOTS.recent, "recent");
  selection.fill(rotate(stable.filter((entry) => isStandalone(entry) && isStableFact(entry)), message.id), SLOTS.stable, "stable");
  selection.fill(byMatchedTerms(chats.filter((entry) => isPastUserTurn(entry, message)), terms), SLOTS.chat, "chat");
  selection.fill(relevant, MAX_MEMORIES, "relevant");
  const picked = selection.entries().map((entry) => withFocus(entry, terms));
  if (typeof graph.reinforce === "function" && picked.length > 0) {
    await graph.reinforce(picked.map(({ id }) => id));
  }
  return picked;
}

export function renderContextMemory(entry: MemoryEntry): string {
  const metadata = entry.metadata ?? {};
  const title = storyTitle(metadata);
  const labels = [
    `addedMemoryDate: ${isoDate(entry.addedMemoryDate ?? entry.createdAt)}`,
    ...(isoDate(entry.factDate) ? [`factDate: ${isoDate(entry.factDate)}`] : []),
    ...(metadata.contextSlot === "chat" ? [`from a past ${String(metadata.channel ?? "")} chat`.replace("  ", " ")] : []),
    ...(title ? [title] : []),
    ...(Array.isArray(metadata.people) && metadata.people.length > 0 ? [`people: ${metadata.people.join(", ")}`] : []),
  ];
  return `- [${labels.join("; ")}] ${excerpt(entry)}`;
}

class Selection {
  private readonly picked: Array<{ entry: MemoryEntry; tokens: Set<string> }> = [];
  private readonly parents = new Map<string, number>();
  private readonly groups = new Map<string, number>();
  private budget = CHAR_BUDGET;

  constructor(private readonly terms: readonly string[]) {}

  fill(candidates: readonly MemoryEntry[], slots: number, slot: Slot): void {
    let added = 0;
    for (const entry of candidates) {
      if (added >= slots || this.picked.length >= MAX_MEMORIES) return;
      if (this.add(entry, slot)) added += 1;
    }
  }

  entries(): MemoryEntry[] {
    return this.picked.map(({ entry }) => entry);
  }

  private add(entry: MemoryEntry, slot: Slot): boolean {
    if (this.picked.some((item) => item.entry.id === entry.id)) return false;
    const parent = parentKey(entry);
    const groups = groupKeys(entry, this.terms);
    if ((this.parents.get(parent) ?? 0) >= MAX_PER_PARENT) return false;
    if (groups.some(({ key, cap }) => (this.groups.get(key) ?? 0) >= cap)) return false;
    const type = slot === "relevant" || slot === "entity" ? undefined : `${slot}:${entityType(entry)}`;
    if (type && (this.groups.get(type) ?? 0) >= MAX_PER_TYPE_OUTSIDE_RELEVANCE) return false;
    const tokens = tokenSet(contentText(entry));
    if (this.picked.some((item) => jaccard(item.tokens, tokens) >= NEAR_DUPLICATE)) return false;
    const size = Math.min(contentText(entry).length, MAX_ITEM_CHARS);
    if (size > this.budget) return false;
    this.budget -= size;
    this.parents.set(parent, (this.parents.get(parent) ?? 0) + 1);
    for (const key of [...groups.map(({ key }) => key), ...(type ? [type] : [])]) {
      this.groups.set(key, (this.groups.get(key) ?? 0) + 1);
    }
    this.picked.push({ entry: { ...entry, metadata: { ...entry.metadata, contextSlot: slot } }, tokens });
    return true;
  }
}

/** Chunks of one long memory count as one source. */
function parentKey(entry: MemoryEntry): string {
  const chunkOf = entry.metadata?.chunkOf;
  return typeof chunkOf === "string" ? chunkOf : entry.id;
}

function storyTitle(metadata: Record<string, unknown>): string | undefined {
  if (typeof metadata.title === "string") return metadata.title;
  return typeof metadata.narrativeArc === "string" ? metadata.narrativeArc : undefined;
}

/** A story arc or imported document groups many memories about the same people. */
function groupKeys(entry: MemoryEntry, terms: readonly string[]): Array<{ key: string; cap: number }> {
  const metadata = entry.metadata ?? {};
  const sourceRefs = metadata.sourceRefs;
  const document = Array.isArray(sourceRefs) ? (sourceRefs[0] as { document?: unknown } | undefined)?.document : undefined;
  const arc = typeof metadata.narrativeArc === "string" ? metadata.narrativeArc : undefined;
  // Asking about the arc itself ("cosa e successo con Alessia?") earns it more room.
  const named = arc !== undefined && terms.some((term) => !COMMON_WORDS.has(term) && arc.toLowerCase().includes(term));
  return [
    ...(arc ? [{ key: `arc:${arc}`, cap: named ? GROUP_CAPS.namedArc : GROUP_CAPS.arc }] : []),
    ...(typeof document === "string" ? [{ key: `document:${document}`, cap: GROUP_CAPS.document }] : []),
  ];
}

/**
 * Entity recall by name or alias, so "la Vale" finds the person node "Valentina", with
 * the entities one hop away in the graph (friends, places, projects).
 */
async function namedEntities(memory: ContextMemory, userId: string, terms: readonly string[]): Promise<MemoryEntry[]> {
  if (typeof memory.listNodes !== "function") return [];
  const specific = terms.filter((term) => !COMMON_WORDS.has(term));
  if (specific.length === 0) return [];
  const nodes = await memory.listNodes({ userId });
  const scored = nodes
    .filter((node) => node.type !== "memory" && node.type !== "protocol")
    .map((node) => ({ node, score: nameScore(node, specific) }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || (right.node.weight ?? 0) - (left.node.weight ?? 0))
    .slice(0, SLOTS.entity);
  return Promise.all(scored.map(async ({ node }) => ({
    id: node.id,
    kind: node.kind ?? "semantic",
    content: { type: node.type, label: node.label, ...asRecord(node.data), related: await relatedLabels(memory, node.id) },
    createdAt: node.createdAt,
    addedMemoryDate: node.addedMemoryDate ?? node.createdAt,
    userId: node.userId,
    metadata: { ...node.metadata },
  })));
}

function nameScore(node: GraphNodeLike, terms: readonly string[]): number {
  const data = asRecord(node.data);
  const aliases = Array.isArray(data.aliases) ? data.aliases.filter((alias): alias is string => typeof alias === "string") : [];
  const tokens = [node.label, ...aliases].flatMap((name) => name.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []);
  return terms.reduce((score, term) => {
    if (tokens.includes(term)) return score + 2;
    return term.length >= 4 && tokens.some((token) => token.startsWith(term)) ? score + 1 : score;
  }, 0);
}

async function relatedLabels(memory: ContextMemory, id: string): Promise<string[]> {
  if (typeof memory.neighbors !== "function") return [];
  const neighbors = await memory.neighbors(id, 1);
  return [...new Set(neighbors.filter((node) => node.type !== "memory").map((node) => `${node.label} (${node.type})`))].slice(0, MAX_RELATED);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : { value };
}

function isStandalone(entry: MemoryEntry): boolean {
  const metadata = entry.metadata ?? {};
  return !(Number(metadata.chunkCount) > 0 && metadata.chunkOf === undefined);
}

/**
 * Only what the user typed or said in another chat: OpenRouter clients resend the whole
 * transcript in every message, and scheduled runs store their prompt as a user turn.
 */
function isPastUserTurn(entry: MemoryEntry, message: InputMessage): boolean {
  if (entry.sessionId === message.sessionId || PROACTIVE_CHANNELS.has(String(entry.metadata?.channel))) return false;
  return !/^(?:Conversation supplied through|\[Scheduled job)/i.test(contentText(entry));
}

const PROACTIVE_CHANNELS = new Set(["cronjob", "pattern-predictor", "email"]);

function isStableFact(entry: MemoryEntry): boolean {
  if (entry.metadata?.namespace === "protocol") return false;
  return contentText(entry).length >= MIN_STABLE_CHARS;
}

/** Different messages surface different stable facts instead of always the same few. */
function rotate(entries: readonly MemoryEntry[], seed: string): readonly MemoryEntry[] {
  if (entries.length === 0) return entries;
  const offset = hash(seed) % entries.length;
  return [...entries.slice(offset), ...entries.slice(0, offset)];
}

function byNewest(entries: readonly MemoryEntry[]): MemoryEntry[] {
  return [...entries].sort((left, right) => timeOf(right) - timeOf(left));
}

/** Remembers where the excerpt window holding most of the request's words starts. */
function withFocus(entry: MemoryEntry, terms: readonly string[]): MemoryEntry {
  const lower = contentText(entry).replace(/\s+/g, " ").toLowerCase();
  if (lower.length <= MAX_ITEM_CHARS) return entry;
  const positions = terms
    .filter((term) => !COMMON_WORDS.has(term))
    .flatMap((term) => [...lower.matchAll(new RegExp(escapeRegExp(term), "g"))].map(({ index }) => ({ term, index })));
  if (positions.length === 0) return entry;
  let best = { start: 0, hits: 0 };
  for (const { index } of positions) {
    const start = Math.max(0, index - 80);
    const hits = new Set(positions.filter((item) => item.index >= start && item.index < start + MAX_ITEM_CHARS - 40).map(({ term }) => term)).size;
    if (hits > best.hits) best = { start, hits };
  }
  return { ...entry, metadata: { ...entry.metadata, contextFocus: best.start } };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function excerpt(entry: MemoryEntry): string {
  const text = contentText(entry).replace(/\s+/g, " ").trim();
  if (text.length <= MAX_ITEM_CHARS) return text;
  const focus = Number(entry.metadata?.contextFocus ?? 0);
  const start = focus > 0 ? text.lastIndexOf(" ", focus) + 1 : 0;
  const cut = text.slice(start, start + MAX_ITEM_CHARS);
  const end = cut.lastIndexOf(" ");
  const body = cut.slice(0, end > MAX_ITEM_CHARS * 0.7 ? end : MAX_ITEM_CHARS);
  return `${start > 0 ? "…" : ""}${body}… [excerpt of ${text.length} chars; memory_retrieval id "${entry.id}" for the full text]`;
}

function contentText(entry: MemoryEntry): string {
  if (typeof entry.content === "string") return entry.content;
  return JSON.stringify(entry.content);
}

function queryTerms(text: string): string[] {
  return [...new Set(text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? [])];
}

/** Past chats that share the request's specific words, the ones sharing most of them first. */
function byMatchedTerms(entries: readonly MemoryEntry[], terms: readonly string[]): MemoryEntry[] {
  const specific = terms.filter((term) => !COMMON_WORDS.has(term));
  return entries
    .map((entry) => {
      const lower = contentText(entry).normalize("NFKC").toLowerCase();
      return { entry, hits: specific.filter((term) => lower.includes(term)).length };
    })
    .filter(({ hits }) => hits > 0)
    .sort((left, right) => right.hits - left.hits)
    .map(({ entry }) => entry);
}

function entityType(entry: MemoryEntry): string {
  if (typeof entry.content === "string") return `memory:${entry.kind}`;
  return String(asRecord(entry.content).type ?? "entity");
}

function tokenSet(text: string): Set<string> {
  return new Set(text.normalize("NFKC").toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []);
}

function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

function hash(value: string): number {
  let result = 0x811c9dc5;
  for (const character of String(value)) {
    result ^= character.codePointAt(0)!;
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
}

function timeOf(entry: MemoryEntry): number {
  return new Date(entry.addedMemoryDate ?? entry.createdAt).getTime();
}

function isoDate(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

// Question words that say nothing about the topic of a past chat.
const COMMON_WORDS = new Set([
  "cosa", "come", "quando", "dove", "perche", "perché", "quale", "quali", "quanto", "quante", "quanti",
  "sono", "hai", "sai", "dirmi", "dimmi", "riesci", "fatto", "andata", "andato", "stato", "stata",
  "questo", "questa", "quello", "quella", "about", "what", "where", "when", "which", "with", "have",
  "sulla", "sullo", "sulle", "della", "delle", "dello", "nella", "nelle", "dalla", "dalle", "alla", "alle",
  "degli", "negli", "sugli", "agli", "dagli", "anche", "ancora", "ciao", "oggi", "fino", "adesso",
]);
