import { randomUUID } from "node:crypto";
import type { InputMessage, Memory, MemoryEntry } from "@agent-os/core/domain";

const CHAT_NAMESPACE = "chat-history";

export interface ConversationHistoryOptions {
  historyLimit?: number;
  memoryLimit?: number;
}

export class ConversationHistory {
  private readonly historyLimit: number;
  private readonly memoryLimit: number;
  private readonly recalledByMessage = new Map<string, readonly MemoryEntry[]>();

  constructor(
    private readonly memory: Memory,
    options: ConversationHistoryOptions = {},
  ) {
    this.historyLimit = Math.max(0, options.historyLimit ?? 20);
    this.memoryLimit = Math.max(0, options.memoryLimit ?? 10);
  }

  async contextualize(message: InputMessage): Promise<InputMessage> {
    const [history, memories] = await Promise.all([
      this.loadHistory(message.sessionId),
      this.loadRelevantMemories(message),
    ]);
    if (memories.length > 0) this.recalledByMessage.set(message.id, memories);
    else this.recalledByMessage.delete(message.id);
    return {
      ...message,
      text: buildContext(message.text, history, memories, message.createdAt),
      metadata: {
        ...message.metadata,
        originalText: originalText(message),
        conversationHistory: history.map((entry) => ({
          role: String(entry.metadata?.role ?? "message"),
          content: renderContent(entry.content),
        })),
        historyEntries: history.length,
        memoryEntries: memories.length,
      },
    };
  }

  async rememberUser(message: InputMessage): Promise<void> {
    const id = `chat-user-${message.id}`;
    await this.memory.remember({
      id,
      kind: "working",
      content: message.text,
      createdAt: message.createdAt,
      userId: message.userId,
      sessionId: message.sessionId,
      metadata: { namespace: CHAT_NAMESPACE, role: "user", channel: message.channel },
    });
    await this.linkRecalledContext(id, message.id);
  }

  async rememberAssistant(message: InputMessage, content: string): Promise<void> {
    const id = `chat-assistant-${message.id}-${randomUUID()}`;
    try {
      await this.memory.remember({
        id,
        kind: "working",
        content,
        createdAt: new Date(),
        userId: message.userId,
        sessionId: message.sessionId,
        metadata: { namespace: CHAT_NAMESPACE, role: "assistant", channel: message.channel },
      });
      await this.linkRecalledContext(id, message.id);
    } finally {
      this.recalledByMessage.delete(message.id);
    }
  }

  clear(sessionId: string): Promise<number> {
    return this.memory.clear({
      sessionId,
      kinds: ["working"],
      metadata: { namespace: CHAT_NAMESPACE },
    });
  }

  private async loadHistory(sessionId: string): Promise<MemoryEntry[]> {
    if (this.historyLimit === 0) return [];
    const entries = await this.memory.recall({
      sessionId,
      kinds: ["working"],
      metadata: { namespace: CHAT_NAMESPACE },
      limit: this.historyLimit,
      order: "newest",
    });
    return [...entries].reverse();
  }

  private async loadRelevantMemories(
    message: InputMessage,
  ): Promise<readonly MemoryEntry[]> {
    if (this.memoryLimit === 0 || !message.userId) return [];
    return this.memory.recall({
      text: originalText(message),
      kinds: ["semantic", "episodic", "procedural"],
      userId: message.userId,
      limit: this.memoryLimit,
      order: "newest",
    });
  }

  private async linkRecalledContext(sourceId: string, messageId: string): Promise<void> {
    const memory = this.memory;
    if (!isLinkableMemory(memory)) return;
    const memories = this.recalledByMessage.get(messageId) ?? [];
    await Promise.all(memories.map((entry, rank) => memory.link({
      sourceId,
      targetId: entry.id,
      type: "retrieved-context",
      metadata: {
        rank,
        score: entry.metadata?.graphScore,
      },
    })));
  }
}

interface LinkableMemory extends Memory {
  link(edge: {
    sourceId: string;
    targetId: string;
    type: string;
    metadata?: Readonly<Record<string, unknown>>;
  }): Promise<unknown>;
}

function isLinkableMemory(memory: Memory): memory is LinkableMemory {
  return "link" in memory && typeof memory.link === "function";
}

function originalText(message: InputMessage): string {
  return typeof message.metadata?.originalText === "string" &&
      message.metadata.originalText.trim()
    ? message.metadata.originalText
    : message.text;
}

function buildContext(
  request: string,
  history: readonly MemoryEntry[],
  memories: readonly MemoryEntry[],
  currentDate: Date,
): string {
  if (history.length === 0 && memories.length === 0) return request;

  const sections: string[] = [];
  if (memories.length > 0) {
    sections.push(
      `Relevant memory (currentDate: ${currentDate.toISOString()}):\n` +
        memories.map(renderMemory).join("\n"),
    );
  }
  if (history.length > 0) {
    sections.push(
      "Conversation history:\n" +
        history
          .map((entry) => {
            const role = String(entry.metadata?.role ?? "message").toUpperCase();
            return `${role}: ${renderContent(entry.content)}`;
          })
          .join("\n"),
    );
  }
  sections.push(`Current request:\n${request}`);
  return sections.join("\n\n");
}

function renderContent(content: unknown): string {
  return typeof content === "string" ? content : JSON.stringify(content);
}

function renderMemory(entry: MemoryEntry): string {
  const addedMemoryDate = validIsoDate(entry.addedMemoryDate ?? entry.createdAt);
  const factDate = validIsoDate(entry.factDate);
  const dates = [
    `addedMemoryDate: ${addedMemoryDate}`,
    ...(factDate ? [`factDate: ${factDate}`] : []),
  ].join("; ");
  return `- [${dates}] ${renderContent(entry.content)}`;
}

function validIsoDate(value: Date | undefined): string | undefined {
  if (!value) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}
