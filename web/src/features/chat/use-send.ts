import { useCallback, useEffect, useRef, useState } from "react";

import { settled, type Conversations } from "../conversations/use-conversations.js";
import { resumeAnswer, streamAnswer } from "./stream-answer.js";

export function useSend({ currentId, conversations, addTurn, patchTurn }: Conversations) {
  const [busy, setBusy] = useState(false);
  const send = useCallback(async (question: string) => {
    const id = Date.now();
    const conversationId = currentId;
    const patch = (fields: Parameters<typeof patchTurn>[2]) => patchTurn(conversationId, id, fields);
    setBusy(true);
    addTurn(conversationId, { id, question, components: [], streaming: true });
    try {
      await streamAnswer(question, conversationId, id, patch);
    } catch (error) {
      patch({ error: error instanceof Error ? error.message : String(error), streaming: false });
    } finally {
      setBusy(false);
    }
  }, [currentId, addTurn, patchTurn]);

  // Turns still streaming when the page was closed keep running on the server: follow them again once.
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current) return;
    resumed.current = true;
    for (const conversation of conversations) {
      for (const turn of conversation.turns) {
        if (!turn.streaming) continue;
        const patch = (fields: Parameters<typeof patchTurn>[2]) => patchTurn(conversation.id, turn.id, fields);
        resumeAnswer(turn.id, patch)
          .then((found) => { if (!found) patch(settled(turn)); })
          .catch((error: unknown) => patch({ error: error instanceof Error ? error.message : String(error), streaming: false }));
      }
    }
  }, [conversations, patchTurn]);

  return { busy, send };
}
