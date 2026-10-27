import { Plus } from "lucide-react";

import { navigate } from "../../app/routes.js";
import { EmptyState } from "../../shared/ui/empty-state.js";
import { EmptyHistoryScene } from "../../shared/ui/illustrations.js";
import { Page } from "../../shared/ui/page.js";
import { PillButton } from "../../shared/ui/pill-button.js";
import { ConversationRow } from "./conversation-row.js";
import type { Conversations } from "./use-conversations.js";

export function HistoryView({ conversations }: { conversations: Conversations }) {
  const pick = (id: string) => { conversations.select(id); navigate("chat"); };
  const startNew = () => { conversations.startNew(); navigate("chat"); };
  return <Page title="Conversations" intro="Everything you asked from this browser." aside={<PillButton onClick={startNew}><span className="group flex items-center gap-1.5"><Plus className="icon-turn size-3.5" />New</span></PillButton>}>
    <ConversationList conversations={conversations} onPick={pick} />
  </Page>;
}

function ConversationList({ conversations, onPick }: { conversations: Conversations; onPick(id: string): void }) {
  if (conversations.conversations.length === 0) return <EmptyState art={<EmptyHistoryScene />} title="No conversations yet" hint="Ask the agent something and the conversation will wait for you here." />;
  return <ul className="-mx-4 space-y-0.5">
    {conversations.conversations.map((item, index) => <ConversationRow
      key={item.id}
      conversation={item}
      index={index}
      current={item.id === conversations.currentId}
      onPick={() => onPick(item.id)}
    />)}
  </ul>;
}
