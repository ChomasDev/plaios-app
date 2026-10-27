import { memo } from "react";

import type { RuntimeComponentDto } from "../../shared/types.js";
import type { Turn } from "../conversations/use-conversations.js";
import { AssistantAnswer } from "./assistant-answer.js";
import { UserBubble } from "./user-bubble.js";

/** One question and its answer. Turns keep their identity until patched, so finished turns never re-render. */
export const TurnView = memo(function TurnView({ turn, components, onAsk }: { turn: Turn; components: RuntimeComponentDto[]; onAsk(text: string): void }) {
  return <article className="space-y-5">
    <UserBubble text={turn.question} />
    <AssistantAnswer turn={turn} components={components} onAsk={onAsk} />
  </article>;
});
