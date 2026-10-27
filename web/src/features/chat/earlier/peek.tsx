import { AnimatePresence, motion, type MotionValue } from "framer-motion";
import type { ReactNode } from "react";

import type { Conversation } from "../../conversations/use-conversations.js";
import { ConversationDivider } from "./conversation-divider.js";

/** The tail of the next older conversation, dragged in by the pull; grows with it and fades up. */
export function Peek({ conversation, height, opacity, children }: { conversation: Conversation; height: MotionValue<number>; opacity: MotionValue<number>; children: ReactNode }) {
  return <motion.div aria-hidden="true" style={{ height }} className="pointer-events-none flex shrink-0 flex-col justify-end overflow-hidden">
    <motion.div style={{ opacity }} className="space-y-10 pb-2">
      <AnimatePresence initial={false}>{children}</AnimatePresence>
      <ConversationDivider startedAt={conversation.startedAt} />
    </motion.div>
  </motion.div>;
}
