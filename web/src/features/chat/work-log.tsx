import { AnimatePresence, motion } from "framer-motion";
import { Check, LoaderCircle, X } from "lucide-react";

import type { Step } from "../conversations/use-conversations.js";

/** What the agent is doing: one line per planning, thinking or tool step. Steps still "running" once the turn ended simply finished unreported. */
export function WorkLog({ steps, streaming }: { steps: Step[]; streaming: boolean }) {
  return <ul aria-label="Agent steps" className="space-y-1 text-xs text-muted-foreground">
    <AnimatePresence initial={false}>
      {steps.map((step) => <motion.li key={step.id} initial={{ opacity: 0, y: -2 }} animate={{ opacity: 1, y: 0 }} className="flex min-w-0 items-start gap-2">
        <StepIcon status={step.status === "running" && !streaming ? "done" : step.status} />
        <span className="shrink-0 font-medium text-foreground/80">{step.label}</span>
        {step.detail ? <span className="truncate font-mono" title={step.detail}>{step.detail}</span> : null}
      </motion.li>)}
    </AnimatePresence>
  </ul>;
}

function StepIcon({ status }: { status: Step["status"] }) {
  if (status === "running") return <LoaderCircle aria-label="Running" className="mt-px size-3.5 shrink-0 animate-spin" />;
  if (status === "failed") return <X aria-label="Failed" className="mt-px size-3.5 shrink-0 text-destructive" />;
  return <Check aria-label="Done" className="mt-px size-3.5 shrink-0" />;
}
