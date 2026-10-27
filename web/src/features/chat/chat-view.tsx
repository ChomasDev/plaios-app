import { AnimatePresence, motion } from "framer-motion";
import { useCallback, type ReactNode } from "react";

import type { RuntimeComponentDto } from "../../shared/types.js";
import type { Conversations, Turn } from "../conversations/use-conversations.js";
import { ChatWelcome } from "./chat-welcome.js";
import { ComposerDock } from "./composer-dock.js";
import { EarlierConversation } from "./earlier/earlier-conversation.js";
import { Peek } from "./earlier/peek.js";
import { ShowEarlierButton } from "./earlier/show-earlier-button.js";
import { useEarlier } from "./earlier/use-earlier.js";
import { TurnView } from "./turn-view.js";
import { useSend } from "./use-send.js";
import { useStickToBottom } from "./use-stick-to-bottom.js";

export function ChatView({ components, conversations }: { components: RuntimeComponentDto[]; conversations: Conversations }) {
  const { currentId, turns } = conversations;
  const { busy, send } = useSend(conversations);
  const scroll = useStickToBottom(currentId);
  const earlier = useEarlier(conversations, scroll.scrollRef, scroll.release);
  const { stick } = scroll;
  const ask = useCallback((text: string) => { stick(); void send(text); }, [stick, send]);
  const renderTurns = (list: Turn[]) => list.map((turn) => <TurnView key={turn.id} turn={turn} components={components} onAsk={ask} />);

  return <div className="flex h-full flex-col">
    <div ref={scroll.scrollRef} onScroll={scroll.onScroll} onWheel={earlier.pull.onWheel} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div ref={scroll.contentRef} className="mx-auto flex min-h-full w-full max-w-4xl flex-col px-6 pt-12">
        {earlier.next ? <ShowEarlierButton onClick={earlier.reveal} /> : null}
        {earlier.next ? <Peek conversation={earlier.next} height={earlier.pull.peekHeight} opacity={earlier.pull.peekOpacity}>{renderTurns(earlier.next.turns.slice(-2))}</Peek> : null}
        {earlier.revealed.map((conversation) => <EarlierConversation key={conversation.id} conversation={conversation}>{renderTurns(conversation.turns)}</EarlierConversation>)}
        {turns.length === 0 ? <ChatWelcome /> : null}
        <TurnList key={currentId}>{renderTurns(turns)}</TurnList>
      </div>
    </div>
    <ComposerDock busy={busy} onSend={ask} />
  </div>;
}

/**
 * Keyed by conversation: opening an old one fades it in as a whole, and `initial={false}` keeps its turns still;
 * only turns added afterwards play their entrance.
 */
function TurnList({ children }: { children: ReactNode }) {
  return <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} className="space-y-10 py-10 empty:py-0">
    <AnimatePresence initial={false}>{children}</AnimatePresence>
  </motion.div>;
}
