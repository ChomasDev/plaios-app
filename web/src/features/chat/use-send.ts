import { useCallback, useState } from "react";

import type { Conversations } from "../conversations/use-conversations.js";
import { streamAnswer } from "./stream-answer.js";

export function useSend({ currentId, addTurn, patchTurn }: Conversations) {
  const [busy, setBusy] = useState(false);
  const send = useCallback(async (question: string) => {
    const id = Date.now();
    const conversationId = currentId;
    const patch = (fields: Parameters<typeof patchTurn>[2]) => patchTurn(conversationId, id, fields);
    setBusy(true);
    addTurn(conversationId, { id, question, components: [], streaming: true });
    try {
      await streamAnswer(question, conversationId, patch);
    } catch (error) {
      patch({ error: error instanceof Error ? error.message : String(error), streaming: false });
    } finally {
      setBusy(false);
    }
  }, [currentId, addTurn, patchTurn]);
  return { busy, send };
}
