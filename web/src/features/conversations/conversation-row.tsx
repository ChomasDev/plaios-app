import { motion } from "framer-motion";

import { formatDate } from "../../shared/format.js";
import { rise, stagger } from "../../shared/motion.js";
import { StatusPill } from "./status-pill.js";
import { conversationStatus, type Conversation } from "./use-conversations.js";

export function ConversationRow({ conversation, index, current, onPick }: { conversation: Conversation; index: number; current: boolean; onPick(): void }) {
  const count = conversation.turnCount;
  const status = conversationStatus(conversation);
  return <motion.li {...rise(stagger(index))}>
    <button
      type="button"
      onClick={onPick}
      aria-current={current ? "true" : undefined}
      className="w-full rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/70 aria-[current]:bg-muted"
    >
      <span className="flex items-center gap-3">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{conversation.title || "Empty"}</span>
        {status ? <StatusPill status={status} /> : null}
      </span>
      <span className="mt-0.5 block text-xs text-muted-foreground">{formatDate(conversation.updatedAt)} · {count} {count === 1 ? "message" : "messages"}</span>
    </button>
  </motion.li>;
}
