import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatAttachmentDto } from "../../shared/types.js";
import { settled, type Conversations } from "../conversations/use-conversations.js";
import { resumeAnswer, streamAnswer } from "./stream-answer.js";

export function useSend({ currentId, conversations, addTurn, patchTurn, refresh }: Conversations) {
  const [busy, setBusy] = useState(false);
  // Turns this tab already follows, sent here or resumed; anything else still streaming is followed once.
  const followed = useRef(new Set<number>());
  const send = useCallback(async (question: string, attachments: ChatAttachmentDto[] = []) => {
    const id = Date.now();
    followed.current.add(id);
    const conversationId = currentId;
    const patch = (fields: Parameters<typeof patchTurn>[2]) => patchTurn(conversationId, id, fields);
    setBusy(true);
    addTurn(conversationId, { id, question, ...(attachments.length ? { attachments } : {}), components: [], streaming: true });
    try {
      await streamAnswer(question, conversationId, id, patch, attachments);
    } catch (error) {
      patch({ error: error instanceof Error ? error.message : String(error), streaming: false, endedAt: new Date().toISOString() });
    } finally {
      setBusy(false);
      // The server decides the sidebar status (answered, or waiting for the user).
      void refresh().catch(() => undefined);
    }
  }, [currentId, addTurn, patchTurn, refresh]);

  // Turns still streaming when the page was closed, or started in another browser, keep running on the server: follow them.
  useEffect(() => {
    for (const conversation of conversations) {
      for (const turn of conversation.turns) {
        if (!turn.streaming || followed.current.has(turn.id)) continue;
        followed.current.add(turn.id);
        const patch = (fields: Parameters<typeof patchTurn>[2]) => patchTurn(conversation.id, turn.id, fields);
        resumeAnswer(turn.id, patch)
          .then((found) => { if (!found) patch(settled(turn)); })
          .catch((error: unknown) => patch({ error: error instanceof Error ? error.message : String(error), streaming: false }));
      }
    }
  }, [conversations, patchTurn]);

  return { busy, send };
}
