import type { Database, DatabaseStructure } from "@plaios/core/domain";

import type { ChatStep, ChatTurnDto, ConversationDto, ConversationStatus, ConversationSummaryDto } from "./types.js";

const ID = /^[\w-]{1,100}$/;
export const CHAT_NAMESPACE = "plaios-chat";

/** How the last exchange ended; with the last visit it decides the sidebar status. */
type LastTurn = "working" | "failed" | "answered" | "asked";

const STRUCTURE: DatabaseStructure = {
  tables: {
    conversations: {
      primaryKey: "id",
      columns: {
        id: { type: "string", required: true },
        title: { type: "string", required: true },
        startedAt: { type: "datetime", required: true },
        updatedAt: { type: "datetime", required: true },
        lastVisitedAt: { type: "datetime" },
        turnCount: { type: "number", required: true },
        lastTurn: { type: "string", required: true },
      },
      indexes: [{ columns: ["updatedAt"] }],
    },
    // One row per exchange: the question, the answer and every step of the work in between.
    messages: {
      primaryKey: "id",
      columns: {
        id: { type: "string", required: true },
        conversationId: { type: "string", required: true },
        /** Order inside the conversation: the client clock when the question was asked. */
        position: { type: "number", required: true },
        question: { type: "string", required: true },
        answer: { type: "string" },
        steps: { type: "json" },
        components: { type: "json", required: true },
        error: { type: "string" },
        streaming: { type: "boolean", required: true },
        createdAt: { type: "datetime", required: true },
        updatedAt: { type: "datetime", required: true },
      },
      indexes: [{ columns: ["conversationId", "position"], unique: true }],
    },
    // Files sent with a message; a table of its own so `messages` keeps its first schema.
    attachments: {
      primaryKey: "id",
      columns: {
        id: { type: "string", required: true },
        messageId: { type: "string", required: true },
        conversationId: { type: "string", required: true },
        position: { type: "number", required: true },
        uploadId: { type: "string", required: true },
        name: { type: "string", required: true },
        mediaType: { type: "string", required: true },
        size: { type: "number", required: true },
      },
      indexes: [{ columns: ["conversationId"] }],
    },
  },
};

interface ConversationRow extends Record<string, unknown> {
  id: string;
  title: string;
  startedAt: Date;
  updatedAt: Date;
  lastVisitedAt?: Date | null;
  turnCount: number;
  lastTurn: LastTurn;
}

interface AttachmentRow extends Record<string, unknown> {
  id: string;
  messageId: string;
  conversationId: string;
  position: number;
  uploadId: string;
  name: string;
  mediaType: string;
  size: number;
}

interface MessageRow extends Record<string, unknown> {
  id: string;
  conversationId: string;
  position: number;
  question: string;
  answer?: string | null;
  steps?: ChatStep[] | null;
  components: string[];
  error?: string | null;
  streaming: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** The web chat's conversations, kept in the host's database so every browser sees the same history. */
export class ConversationStore {
  private ready?: { database: Database; init: Promise<void> };
  private writes = Promise.resolve();

  /** `database` resolves the runtime's current database view; it changes when the runtime reloads. */
  constructor(private readonly database: () => Database | undefined) {}

  async list(): Promise<ConversationSummaryDto[]> {
    const db = await this.db();
    const rows = await db.get<ConversationRow>("conversations", { orderBy: [{ field: "updatedAt", direction: "desc" }] });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      startedAt: iso(row.startedAt),
      updatedAt: iso(row.updatedAt),
      turnCount: Number(row.turnCount),
      status: statusOf(row),
    }));
  }

  async get(id: string): Promise<ConversationDto | undefined> {
    if (!ID.test(id)) return undefined;
    const db = await this.db();
    const row = await db.get<ConversationRow>("conversations", id);
    if (!row) return undefined;
    const messages = await db.get<MessageRow>("messages", { where: { conversationId: id }, orderBy: [{ field: "position", direction: "asc" }] });
    const attachments = await db.get<AttachmentRow>("attachments", { where: { conversationId: id }, orderBy: [{ field: "position", direction: "asc" }] });
    return {
      id,
      title: row.title,
      startedAt: iso(row.startedAt),
      updatedAt: iso(row.updatedAt),
      turns: messages.map((message) => {
        const files = attachments.filter(({ messageId }) => messageId === message.id).map(({ uploadId, name, mediaType, size }) => ({ id: uploadId, name, mediaType, size: Number(size) }));
        return files.length ? { ...toTurn(message), attachments: files } : toTurn(message);
      }),
    };
  }

  /** Adds the turn or replaces the one with the same id. Writes queue up so a turn's saves never interleave. */
  saveTurn(conversationId: string, turn: ChatTurnDto): Promise<void> {
    if (!ID.test(conversationId)) return Promise.reject(new Error(`Invalid conversation id: ${conversationId}`));
    const write = this.writes.then(async () => {
      const db = await this.db();
      const now = new Date();
      const id = `${conversationId}:${turn.id}`;
      const existing = await db.get<MessageRow>("messages", id);
      await db.set<MessageRow>("messages", id, {
        id,
        conversationId,
        position: turn.id,
        question: turn.question,
        answer: turn.answer ?? null,
        steps: turn.steps ?? null,
        components: turn.components ?? [],
        error: turn.error ?? null,
        streaming: turn.streaming === true,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      for (const [index, file] of (turn.attachments ?? []).entries()) {
        await db.set<AttachmentRow>("attachments", `${id}:${file.id}`, { id: `${id}:${file.id}`, messageId: id, conversationId, position: index, uploadId: file.id, name: file.name, mediaType: file.mediaType, size: file.size });
      }
      await this.touch(db, conversationId, now);
    });
    this.writes = write.catch(() => undefined);
    return write;
  }

  /** The user looked at the conversation: its finished state stops being news. */
  async visit(conversationId: string): Promise<void> {
    if (!ID.test(conversationId)) return;
    const db = await this.db();
    await db.update<ConversationRow>("conversations", conversationId, { lastVisitedAt: new Date() });
  }

  /** Brings in conversations a browser kept before history moved to the server; turns already here win. */
  async import(conversations: readonly ConversationDto[]): Promise<number> {
    let imported = 0;
    for (const conversation of conversations) {
      if (!ID.test(conversation?.id ?? "") || !Array.isArray(conversation.turns)) continue;
      const known = new Set((await this.get(conversation.id))?.turns.map(({ id }) => id));
      for (const turn of conversation.turns) {
        if (typeof turn?.id !== "number" || typeof turn.question !== "string" || known.has(turn.id)) continue;
        await this.saveTurn(conversation.id, { ...turn, ...(turn.streaming ? settled(turn) : {}), components: Array.isArray(turn.components) ? turn.components : [] });
        imported += 1;
      }
      // Imported history was seen in the browser it came from.
      await this.visit(conversation.id);
    }
    return imported;
  }

  /** Recounts the conversation from its messages, so title, count and last state never drift. */
  private async touch(db: Database, conversationId: string, now: Date): Promise<void> {
    const messages = await db.get<MessageRow>("messages", { where: { conversationId }, orderBy: [{ field: "position", direction: "asc" }] });
    const existing = await db.get<ConversationRow>("conversations", conversationId);
    const last = messages.at(-1);
    await db.set<ConversationRow>("conversations", conversationId, {
      id: conversationId,
      title: (messages[0]?.question || "Attachment").slice(0, 120),
      startedAt: existing?.startedAt ?? now,
      updatedAt: now,
      lastVisitedAt: existing?.lastVisitedAt ?? null,
      turnCount: messages.length,
      lastTurn: last ? lastTurnOf(toTurn(last)) : "answered",
    });
  }

  private async db(): Promise<Database> {
    const database = this.database();
    if (!database) throw new Error("Chat history needs a database component; install one (for example @plaios/sqlite).");
    if (this.ready?.database !== database) this.ready = { database, init: this.initialize(database) };
    await this.ready.init;
    return database;
  }

  private async initialize(db: Database): Promise<void> {
    await db.init(STRUCTURE);
    // Live turns die with the process that ran them.
    for (const row of await db.get<MessageRow>("messages", { where: { streaming: true } })) {
      await db.set<MessageRow>("messages", row.id, { ...row, ...settledRow(row) });
      await this.touch(db, row.conversationId, new Date(row.updatedAt));
    }
  }
}

function toTurn(row: MessageRow): ChatTurnDto {
  return {
    id: Number(row.position),
    question: row.question,
    ...(row.answer != null ? { answer: row.answer } : {}),
    ...(row.steps ? { steps: row.steps } : {}),
    components: row.components ?? [],
    ...(row.error ? { error: row.error } : {}),
    // The last save of a finished turn is when it ended.
    ...(row.streaming ? { streaming: true } : { endedAt: iso(row.updatedAt) }),
  };
}

function settledRow(row: MessageRow): Partial<MessageRow> {
  const turn = settled(toTurn(row));
  return { streaming: false, ...(turn.error ? { error: turn.error } : {}) };
}

export function settled(turn: ChatTurnDto): Partial<ChatTurnDto> {
  return turn.answer ? { streaming: false } : { streaming: false, error: turn.error ?? "Interrupted before an answer arrived." };
}

/**
 * shortcut: an answer whose last line is a question counts as waiting for the user,
 * the agent has no explicit "ask the user" tool yet; add one if this misfires.
 */
export function lastTurnOf(turn: ChatTurnDto): LastTurn {
  if (turn.streaming) return "working";
  if (turn.error) return "failed";
  const lastLine = (turn.answer ?? "").trim().split("\n").filter((line) => line.trim()).at(-1) ?? "";
  return /\?[\s*_)"'»”]*$/.test(lastLine) ? "asked" : "answered";
}

/** T3 Code's rules: working always shows; a failure or a finished answer shows until the user opens the conversation. */
export function statusOf(row: Pick<ConversationRow, "lastTurn" | "updatedAt" | "lastVisitedAt">): ConversationStatus | null {
  if (row.lastTurn === "working") return "working";
  // A question stays open until the user answers it, seen or not.
  if (row.lastTurn === "asked") return "awaiting-input";
  const unseen = !row.lastVisitedAt || new Date(row.updatedAt).getTime() > new Date(row.lastVisitedAt).getTime();
  if (!unseen) return null;
  if (row.lastTurn === "failed") return "failed";
  return row.lastVisitedAt ? "completed" : null;
}

/** Folds one streamed chat event into the turn, the same way the browser does. */
export function applyChatEvent(turn: ChatTurnDto, event: { delta?: unknown; step?: unknown; done?: unknown; components?: unknown; error?: unknown }): ChatTurnDto {
  if (typeof event.error === "string") return { ...turn, error: event.error, streaming: false };
  let next = turn;
  if (event.step && typeof event.step === "object") next = { ...next, steps: mergeStep(next.steps ?? [], event.step as ChatStep) };
  if (typeof event.delta === "string") next = { ...next, answer: (next.answer ?? "") + event.delta };
  if (event.done) next = { ...next, answer: next.answer ?? "", components: Array.isArray(event.components) ? event.components as string[] : [], streaming: false };
  return next;
}

/** A later step with the same id updates it; a `delta` grows its output. */
export function mergeStep(steps: readonly ChatStep[], step: ChatStep): ChatStep[] {
  const { delta, ...fields } = step;
  const index = steps.findIndex(({ id }) => id === step.id);
  const grown = (item?: ChatStep): ChatStep => delta ? { ...fields, output: (item?.output ?? "") + delta } : fields;
  if (index === -1) return [...steps, grown()];
  return steps.map((item, at) => at === index ? { ...item, ...grown(item) } : item);
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}
