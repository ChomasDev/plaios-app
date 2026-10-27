import { motion } from "framer-motion";

import { formatDate } from "../../shared/format.js";
import { rise, stagger } from "../../shared/motion.js";
import type { Conversation } from "./use-conversations.js";

export function ConversationRow({ conversation, index, current, onPick }: { conversation: Conversation; index: number; current: boolean; onPick(): void }) {
  const count = conversation.turns.length;
  return <motion.li {...rise(stagger(index))}>
    <button
      type="button"
      onClick={onPick}
      aria-current={current ? "true" : undefined}
      className="w-full rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/70 aria-[current]:bg-muted"
    >
      <span className="block truncate text-sm font-medium">{conversation.turns[0]?.question ?? "Empty"}</span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{formatDate(conversation.startedAt)} · {count} {count === 1 ? "message" : "messages"}</span>
    </button>
  </motion.li>;
}
