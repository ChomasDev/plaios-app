import { AnimatePresence } from "framer-motion";
import { useRef } from "react";

import type { RuntimeComponentDto } from "../shared/types.js";
import { ChatView } from "../features/chat/chat-view.js";
import { HistoryView } from "../features/conversations/history-view.js";
import { useConversations } from "../features/conversations/use-conversations.js";
import { ManageView } from "./manage-view.js";
import { navigate, paneOf, type Pane, type Route, type View } from "./routes.js";
import { Backdrop, Sheet } from "./sheet.js";
import { usePaneGestures } from "./use-pane-gestures.js";

/** Chat is always underneath; History slides over from the left, everything else from the right. */
export function Workspace({ route, components }: { route: Route; components: RuntimeComponentDto[] }) {
  const conversations = useConversations();
  const mainRef = useRef<HTMLElement>(null);
  const lastManage = useRef<View>("components");
  const pane = paneOf(route.view);
  if (pane === "manage") lastManage.current = route.view;
  const goTo = (next: Pane) => {
    // From a package or component page, swiping back (or Escape) returns to its list before closing the sheet.
    const parent = route.packageName ? "store" : route.selectedId ? "components" : undefined;
    if (pane === "manage" && next !== "manage" && parent) return navigate(parent);
    navigate(next === "manage" ? lastManage.current : next);
  };
  usePaneGestures(mainRef, pane, goTo);

  return <main ref={mainRef} className="relative min-h-0 flex-1 overflow-hidden">
    <ChatView components={components} conversations={conversations} />
    <AnimatePresence>
      {pane !== "chat" ? <Backdrop key="backdrop" onClose={() => navigate("chat")} /> : null}
      {pane === "history" ? <Sheet key="history" side="left" label="Conversations"><HistoryView conversations={conversations} /></Sheet> : null}
      {pane === "manage" ? <Sheet key="manage" side="right" label="Manage"><ManageView route={route} components={components} /></Sheet> : null}
    </AnimatePresence>
  </main>;
}
