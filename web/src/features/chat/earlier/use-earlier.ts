import { useCallback, useEffect, useState, type RefObject } from "react";

import type { Conversation, Conversations } from "../../conversations/use-conversations.js";
import { usePullToReveal } from "./use-pull-to-reveal.js";

/** Conversations above the current one, revealed one at a time by pulling past the top (or the button on touch screens). */
export function useEarlier({ conversations, currentId, load }: Conversations, scrollRef: RefObject<HTMLElement | null>, release: () => void) {
  const [count, setCount] = useState(0);
  const older = olderThan(conversations, currentId);
  const next = older[count];
  // The peek shows the next one's last turns, so fetch them before the pull starts.
  useEffect(() => { if (next && !next.loaded) load(next.id); }, [next, load]);
  const reveal = useCallback(() => { release(); setCount((value) => value + 1); }, [release]);
  const pull = usePullToReveal(scrollRef, Boolean(next), { onPull: release, onSnap: reveal });
  const { reset } = pull;
  useEffect(() => { setCount(0); reset(); }, [currentId, reset]);
  // Oldest first, so they read top to bottom into the current conversation.
  return { revealed: older.slice(0, count).reverse(), next, reveal, pull };
}

/** The list is ordered by last activity, newest first; a conversation not stored yet sits above all of them. */
function olderThan(list: Conversation[], id: string): Conversation[] {
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return list;
  return list.slice(index + 1);
}
