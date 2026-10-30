import { useCallback, useEffect, useRef, useState } from "react";

import { postJson, requestJson } from "../../shared/api.js";
import type { ChatStep as Step, ChatTurnDto, ConversationDto, ConversationStatus, ConversationSummaryDto } from "../../shared/types.js";

export type { Step };
export type Turn = ChatTurnDto;
/** A conversation from the server; `turns` stays empty until it is opened (`loaded`). */
export interface Conversation extends ConversationSummaryDto { turns: Turn[]; loaded: boolean }

/** What the sidebar shows: a turn running in this tab is "working" before the server says so. */
export function conversationStatus(conversation: Conversation): ConversationStatus | null {
  return conversation.turns.some(({ streaming }) => streaming) ? "working" : conversation.status;
}

/** Where conversations lived before the server kept them; imported once, then cleared. */
const LEGACY_KEY = "agent-os-conversations";
const NO_TURNS: Turn[] = [];

/** crypto.randomUUID only exists in secure contexts; plain-HTTP visits still need ids. */
function uid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A turn the server no longer knows (it restarted, or the turn expired) can only be shown as finished. */
export function settled(turn: Turn): Partial<Turn> {
  if (turn.answer) return { streaming: false };
  return { streaming: false, error: "Interrupted before an answer arrived." };
}

async function importLegacy(): Promise<void> {
  const stored = localStorage.getItem(LEGACY_KEY);
  if (!stored) return;
  const conversations = (JSON.parse(stored) as ConversationDto[]).filter((item) => item.turns?.length);
  if (conversations.length) await postJson("/api/conversations/import", { conversations });
  localStorage.removeItem(LEGACY_KEY);
}

/** Keeps turns already open here; a conversation that grew elsewhere reloads when next opened. */
function merge(summaries: ConversationSummaryDto[], local: Conversation[]): Conversation[] {
  const known = new Map(local.map((item) => [item.id, item]));
  const fromServer = summaries.map((summary) => {
    const mine = known.get(summary.id);
    const stale = !mine?.loaded || (mine.turnCount !== summary.turnCount && !mine.turns.some(({ streaming }) => streaming));
    return stale ? { ...summary, turns: mine?.turns ?? [], loaded: false } : { ...mine, ...summary, turnCount: mine.turns.length };
  });
  // Started here and not saved yet: stays on top.
  const unsaved = local.filter((item) => !summaries.some(({ id }) => id === item.id));
  return [...unsaved, ...fromServer];
}

/** Conversations kept by the host, newest first, so every browser shows the same history. Updates are functional so streamed tokens never race each other. */
export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentId, setCurrentId] = useState(uid);
  const loading = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    const summaries = await requestJson<ConversationSummaryDto[]>("/api/conversations");
    setConversations((local) => merge(summaries, local));
  }, []);

  useEffect(() => {
    void importLegacy().catch((error: unknown) => console.warn("[conversations] browser history not imported", error)).then(refresh);
    // Another browser may have chatted meanwhile.
    const onFocus = () => void refresh().catch(() => undefined);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  /** Fetches a conversation's turns the first time it is shown. */
  const load = useCallback((id: string) => {
    if (loading.current.has(id)) return;
    loading.current.add(id);
    void requestJson<ConversationDto>(`/api/conversations/item?id=${encodeURIComponent(id)}`)
      .then((conversation) => setConversations((list) => list.map((item) => item.id === id && !item.loaded ? { ...item, turns: conversation.turns, turnCount: conversation.turns.length, loaded: true } : item)))
      .catch((error: unknown) => console.warn("[conversations] not loaded", error))
      .finally(() => loading.current.delete(id));
  }, []);

  const current = conversations.find((item) => item.id === currentId);
  useEffect(() => { if (current && !current.loaded) load(current.id); }, [current, load]);

  // Looking at a conversation clears its "completed" or "failed" news, as in T3 Code; again when its turn ends in view.
  const settledCount = current?.turns.filter(({ streaming }) => !streaming).length ?? 0;
  useEffect(() => {
    if (!current || current.turnCount === 0) return;
    const visit = () => {
      if (document.visibilityState !== "visible") return;
      void postJson("/api/conversations/visit", { id: current.id }).catch(() => undefined);
      setConversations((list) => list.map((item) => item.id === current.id && (item.status === "completed" || item.status === "failed") ? { ...item, status: null } : item));
    };
    visit();
    document.addEventListener("visibilitychange", visit);
    return () => document.removeEventListener("visibilitychange", visit);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run per conversation and per finished turn, not per streamed token
  }, [current?.id, current?.turnCount, settledCount]);

  // Work running in another browser has no stream here: poll until it settles.
  const elsewhere = conversations.some((item) => item.status === "working" && !item.turns.some(({ streaming }) => streaming));
  useEffect(() => {
    if (!elsewhere) return;
    const timer = setInterval(() => void refresh().catch(() => undefined), 5_000);
    return () => clearInterval(timer);
  }, [elsewhere, refresh]);

  const addTurn = useCallback((conversationId: string, turn: Turn) => setConversations((list) => {
    const now = new Date().toISOString();
    const existing = list.find((item) => item.id === conversationId);
    const turns = [...(existing?.turns ?? []), turn];
    const conversation: Conversation = existing
      ? { ...existing, turns, turnCount: turns.length, updatedAt: now }
      : { id: conversationId, title: turn.question || turn.attachments?.[0]?.name || "Attachment", startedAt: now, updatedAt: now, turnCount: 1, status: "working" as const, turns, loaded: true };
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
    turns: current?.turns ?? NO_TURNS,
    select: setCurrentId,
    startNew,
    load,
    refresh,
    addTurn,
    patchTurn,
  };
}

export type Conversations = ReturnType<typeof useConversations>;
