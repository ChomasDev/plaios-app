import { motion } from "framer-motion";

import type { RuntimeComponentDto } from "../../shared/types.js";
import type { Turn } from "../conversations/use-conversations.js";
import { Surface } from "../surface/surface.js";
import { Markdown } from "./markdown.js";
import { GenerativeAnswer } from "./openui/generative-answer.js";
import { ThinkingDots } from "./thinking-dots.js";

interface AnswerProps { turn: Turn; components: RuntimeComponentDto[]; onAsk(text: string): void }

export function AssistantAnswer({ turn, components, onAsk }: AnswerProps) {
  return <div className="space-y-5">
    <div className="text-[15px] leading-7">
      {/* Keyed by phase: the dots vanish and the answer fades in, without a crossfade that shifts layout. */}
      <motion.div key={phaseOf(turn)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        <AnswerBody turn={turn} components={components} onAsk={onAsk} />
      </motion.div>
    </div>
    <AnswerSurfaces ids={turn.components} components={components} />
  </div>;
}

function phaseOf(turn: Turn): "error" | "thinking" | "answer" {
  if (turn.error) return "error";
  if (turn.answer === undefined) return "thinking";
  return "answer";
}

function AnswerBody({ turn, components, onAsk }: AnswerProps) {
  if (turn.error) return <p className="text-destructive">{turn.error}</p>;
  if (turn.answer === undefined) return <ThinkingDots />;
  if (isOpenUI(turn.answer)) return <GenerativeAnswer text={turn.answer} streaming={turn.streaming === true} components={components} onAsk={onAsk} />;
  return <Markdown text={turn.answer} />;
}

/** Cards of the components the agent used for this answer. */
function AnswerSurfaces({ ids, components }: { ids: string[]; components: RuntimeComponentDto[] }) {
  return ids.map((instanceId) => {
    const component = components.find((item) => item.instanceId === instanceId);
    if (!component) return null;
    return <Surface key={instanceId} component={component} variant="chat" />;
  });
}

/** OpenUI Lang is a list of `name = Expression` lines; anything else is prose. */
function isOpenUI(text: string): boolean {
  return /^\s*(```[a-z-]*\s*)?[A-Za-z_]\w*\s*=\s*\S/.test(text);
}
