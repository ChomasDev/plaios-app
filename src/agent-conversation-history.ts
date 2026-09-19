import { randomUUID } from "node:crypto";
import type { InputMessage, Memory, MemoryEntry } from "@agent-os/core/domain";

const CHAT_NAMESPACE = "chat-history";

export const CONVERSATION_HISTORY_LIMIT = 10;

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
    this.historyLimit = Math.max(0, options.historyLimit ?? CONVERSATION_HISTORY_LIMIT);
    this.memoryLimit = Math.max(0, options.memoryLimit ?? 10);
  }

  async contextualize(message: InputMessage): Promise<InputMessage> {
    const [history, memories] = await Promise.all([
      this.loadHistory(message.sessionId),
      this.loadRelevantMemories(message),
    ]);
    if (memories.length > 0) this.recalledByMessage.set(message.id, memories);
    else this.recalledByMessage.delete(message.id);
    const incomingHistory = incomingConversationHistory(message);
    const storedHistory = history.map((entry) => ({
      role: String(entry.metadata?.role ?? "message"),
      content: renderContent(entry.content),
    }));
    const currentText = lastUserUtterance(originalText(message));
    const fromTranscript = previousTranscriptTurns(originalText(message));
    const conversationHistory = lastTurns(
      fromTranscript.length > 0
        ? fromTranscript
        : incomingHistory.length > 0
          ? incomingHistory
          : storedHistory,
      this.historyLimit,
    );
    return {
      ...message,
      text: buildContext(message.text, conversationHistory, memories, message.createdAt),
      metadata: {
        ...message.metadata,
        originalText: currentText,
        conversationHistory,
        historyEntries: conversationHistory.length,
        memoryEntries: memories.length,
      },
    };
  }

  async rememberUser(message: InputMessage): Promise<void> {
    const id = `chat-user-${message.id}`;
    await this.memory.remember({
      id,
      kind: "working",
      content: originalText(message),
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

function incomingConversationHistory(
  message: InputMessage,
): Array<{ role: string; content: string }> {
  const value = message.metadata?.conversationHistory;
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const role = "role" in entry && typeof entry.role === "string" ? entry.role : "";
    const content = "content" in entry && typeof entry.content === "string" ? entry.content : "";
    return role && content ? [{ role, content }] : [];
  });
}

function originalText(message: InputMessage): string {
  return typeof message.metadata?.originalText === "string" &&
      message.metadata.originalText.trim()
    ? message.metadata.originalText
    : message.text;
}

function lastUserUtterance(text: string): string {
  const turns = parseTranscriptTurns(text);
  const lastUser = [...turns].reverse().find((turn) => turn.role === "user");
  return lastUser?.content ?? text.trim();
}

function previousTranscriptTurns(text: string): Array<{ role: string; content: string }> {
  const turns = parseTranscriptTurns(text);
  if (turns.length === 0) return [];
  let lastUserIndex = -1;
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (turns[index]?.role === "user") {
      lastUserIndex = index;
      break;
    }
  }
  return lastUserIndex > 0 ? turns.slice(0, lastUserIndex) : [];
}

function parseTranscriptTurns(text: string): Array<{ role: string; content: string }> {
  const trimmed = text.trim();
  if (!/(?:^|\n)(?:USER|ASSISTANT|SYSTEM):/i.test(trimmed)) return [];
  return trimmed
    .split(/\n(?=(?:USER|ASSISTANT|SYSTEM):)/i)
    .flatMap((block) => {
      const match = block.match(/^(USER|ASSISTANT|SYSTEM):\s*([\s\S]*)$/i);
      if (!match) return [];
      const content = match[2]!.trim();
      if (!content) return [];
      return [{ role: match[1]!.toLowerCase(), content }];
    });
}

function lastTurns<T>(items: readonly T[], limit: number): T[] {
  return limit > 0 ? items.slice(-limit) : [];
}

function buildContext(
  request: string,
  history: Array<{ role: string; content: string }>,
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
        history.map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`).join("\n"),
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
