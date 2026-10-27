import { useCallback, useEffect, useState } from "react";

export interface Turn { id: number; question: string; answer?: string; components: string[]; error?: string; streaming?: boolean }
export interface Conversation { id: string; startedAt: string; turns: Turn[] }

const KEY = "agent-os-conversations";
const LIMIT = 50;
const NO_TURNS: Turn[] = [];

/** crypto.randomUUID only exists in secure contexts; plain-HTTP visits still need ids. */
function uid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function load(): Conversation[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "[]") as Conversation[];
    return stored.map((conversation) => ({ ...conversation, turns: conversation.turns.map(settle) }));
  } catch {
    return [];
  }
}

/** A turn still streaming in storage was cut off by a reload; show it as finished. */
function settle(turn: Turn): Turn {
  if (!turn.streaming) return turn;
  if (turn.answer) return { ...turn, streaming: false };
  return { ...turn, streaming: false, error: "Interrupted before an answer arrived." };
}

function save(conversations: Conversation[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(conversations.slice(0, LIMIT)));
  } catch (error) {
    // A full quota must not take the chat down; history simply stops persisting.
    console.warn("[conversations] not saved", error);
  }
}

/** Conversations live in this browser, newest first. Updates are functional so streamed tokens never race each other. */
export function useConversations() {
  const [conversations, setConversations] = useState(load);
  const [currentId, setCurrentId] = useState(uid);
  useEffect(() => save(conversations), [conversations]);

  const addTurn = useCallback((conversationId: string, turn: Turn) => setConversations((list) => {
    const existing = list.find((item) => item.id === conversationId);
    const conversation = existing
      ? { ...existing, turns: [...existing.turns, turn] }
      : { id: conversationId, startedAt: new Date().toISOString(), turns: [turn] };
    return [conversation, ...list.filter((item) => item.id !== conversationId)];
  }), []);

  const patchTurn = useCallback((conversationId: string, turnId: number, fields: Partial<Turn>) => setConversations((list) => list.map((conversation) => {
    if (conversation.id !== conversationId) return conversation;
    return { ...conversation, turns: conversation.turns.map((turn) => turn.id === turnId ? { ...turn, ...fields } : turn) };
  })), []);

  const startNew = useCallback(() => setCurrentId(uid()), []);

  return {
    conversations,
    currentId,
    turns: conversations.find((item) => item.id === currentId)?.turns ?? NO_TURNS,
    select: setCurrentId,
    startNew,
    addTurn,
    patchTurn,
  };
}

export type Conversations = ReturnType<typeof useConversations>;
