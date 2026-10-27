import { cn } from "@agent-os/microfrontend";
import { AnimatePresence, motion } from "framer-motion";
import { useState, type ReactNode } from "react";

import { SHEET_EASE } from "../../../shared/motion.js";
import type { Conversation } from "../../conversations/use-conversations.js";
import { ConversationDivider } from "./conversation-divider.js";

/** An older conversation unfolding above the current one. Its turns stay still; only the section opens. */
export function EarlierConversation({ conversation, children }: { conversation: Conversation; children: ReactNode }) {
  // Clip only while the height animates; afterwards wide answers may overflow the column.
  const [settled, setSettled] = useState(false);
  return <motion.section
    initial={{ height: 0, opacity: 0 }}
    animate={{ height: "auto", opacity: 1 }}
    transition={{ duration: 0.45, ease: SHEET_EASE }}
    onAnimationComplete={() => setSettled(true)}
    className={cn("space-y-10 pt-10", !settled && "overflow-hidden")}
  >
    <AnimatePresence initial={false}>{children}</AnimatePresence>
    <ConversationDivider startedAt={conversation.startedAt} />
  </motion.section>;
}
