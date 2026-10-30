import type { Capability, CapabilityManifest, CapabilityResult, Memory, MemoryEntry, UIComponentSpec } from "@plaios/core/domain";

export const CONVERSATIONS_ID = "plaios.conversations";
const CHAT_NAMESPACE = "chat-history";
const SCAN_LIMIT = 1_000;
const LIST_LIMIT = 20;
const READ_LIMIT = 200;
const MESSAGE_CHARS = 1_500;

export interface ReadConversationsInput { action: "list" | "read" | "search"; sessionId: string | null; query: string | null }

const manifest: CapabilityManifest = {
  id: CONVERSATIONS_ID,
  version: "1.0.0",
  name: "read_conversations",
  description: "Reads the user's past conversations with you on every channel (web chat, Telegram, voice, scheduled runs): list the recent ones, read one in full, or search them for a topic. Use it when the user refers to another chat or to something said before that is not in this conversation.",
  inputSchema: {
    type: "object",
    properties: {
      action: { type: "string", enum: ["list", "read", "search"] },
      sessionId: { type: ["string", "null"], description: "read: the conversation id returned by list or search." },
      query: { type: ["string", "null"], description: "search: words or topic to look for." },
    },
    required: ["action", "sessionId", "query"],
    additionalProperties: false,
  },
  tags: ["conversation", "conversations", "chat", "history", "previous", "earlier", "transcript", "conversazione", "chat precedente"],
  execution: { timeoutMs: 15_000, idempotent: true },
};

/** Built into the host: the chat history the runtime already keeps in memory, readable across conversations. */
export class ConversationsCapability implements Capability<ReadConversationsInput, { text: string }> {
  readonly manifest = manifest;

  constructor(private readonly memory: () => Memory | undefined) {}

  uiComponents(): readonly UIComponentSpec[] { return []; }

  docs(): string {
    return "`list` → recent conversations with their id, channel, date and first message. `read` with an id → the transcript, oldest first. `search` with a query → matching messages and the conversation they belong to.";
  }

  async execute(input: ReadConversationsInput): Promise<CapabilityResult<{ text: string }>> {
    const memory = this.memory();
    if (!memory) return failure("NO_MEMORY", "No memory component is running, so no history is kept.");
    if (input.action === "list") return ok(listConversations(await memory.recall({ kinds: ["working"], metadata: { namespace: CHAT_NAMESPACE }, limit: SCAN_LIMIT, order: "newest" })));
    if (input.action === "read") {
      const sessionId = input.sessionId?.trim();
      if (!sessionId) return failure("VALIDATION_ERROR", "read needs the sessionId from list or search.");
      const entries = await memory.recall({ sessionId, kinds: ["working"], metadata: { namespace: CHAT_NAMESPACE }, limit: READ_LIMIT, order: "newest" });
      if (entries.length === 0) return failure("NOT_FOUND", `No conversation "${sessionId}".`);
      return ok([`Conversation ${sessionId}, oldest first:`, ...[...entries].sort(byTime).map(line)].join("\n"));
    }
    if (input.action === "search") {
      const query = input.query?.trim();
      if (!query) return failure("VALIDATION_ERROR", "search needs a query.");
      const entries = await memory.recall({ text: query, kinds: ["working"], metadata: { namespace: CHAT_NAMESPACE }, limit: 30 });
      if (entries.length === 0) return ok(`Nothing about "${query}" in past conversations.`);
      return ok(entries.map((entry) => `${line(entry)}  (conversation ${entry.sessionId})`).join("\n"));
    }
    return failure("VALIDATION_ERROR", "action must be list, read or search.");
  }
}

export function listConversations(entries: readonly MemoryEntry[]): string {
  const sessions = new Map<string, MemoryEntry[]>();
  for (const entry of entries) {
    if (!entry.sessionId) continue;
    sessions.set(entry.sessionId, [...(sessions.get(entry.sessionId) ?? []), entry]);
  }
  if (sessions.size === 0) return "No past conversations.";
  return [...sessions.entries()].slice(0, LIST_LIMIT).map(([sessionId, messages]) => {
    const ordered = [...messages].sort(byTime);
    const first = ordered.find((entry) => entry.metadata?.role === "user") ?? ordered[0]!;
    const last = ordered.at(-1)!;
    return `- ${sessionId} · ${String(last.metadata?.channel ?? "?")} · ${iso(last.createdAt)} · ${messages.length} message(s) · "${text(first).slice(0, 100)}"`;
  }).join("\n");
}

function line(entry: MemoryEntry): string {
  return `[${iso(entry.createdAt)}] ${String(entry.metadata?.role ?? "?").toUpperCase()}: ${text(entry).slice(0, MESSAGE_CHARS)}`;
}

function text(entry: MemoryEntry): string {
  return (typeof entry.content === "string" ? entry.content : JSON.stringify(entry.content)).replace(/\s+/g, " ").trim();
}

function iso(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 16).replace("T", " ");
}

function byTime(left: MemoryEntry, right: MemoryEntry): number {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}

function ok(value: string): CapabilityResult<{ text: string }> {
  return { success: true, data: { text: value } };
}

function failure(code: string, message: string): CapabilityResult<never> {
  return { success: false, error: { code, message, retryable: false } };
}
