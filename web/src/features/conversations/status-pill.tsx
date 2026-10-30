import { cn } from "@plaios/microfrontend";

import type { ConversationStatus } from "../../shared/types.js";

/** T3 Code's thread pills: label, colour and whether the dot pulses. */
const PILLS: Record<ConversationStatus, { label: string; text: string; dot: string; pulse: boolean }> = {
  working: { label: "Working", text: "text-sky-600 dark:text-sky-300/80", dot: "bg-sky-500 dark:bg-sky-300/80", pulse: true },
  "awaiting-input": { label: "Awaiting Input", text: "text-indigo-600 dark:text-indigo-300/90", dot: "bg-indigo-500 dark:bg-indigo-300/90", pulse: false },
  failed: { label: "Failed", text: "text-red-600 dark:text-red-300/90", dot: "bg-red-500 dark:bg-red-300/90", pulse: false },
  completed: { label: "Completed", text: "text-emerald-600 dark:text-emerald-300/90", dot: "bg-emerald-500 dark:bg-emerald-300/90", pulse: false },
};

export function StatusPill({ status, compact }: { status: ConversationStatus; compact?: boolean }) {
  const pill = PILLS[status];
  return <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium", pill.text)} title={pill.label}>
    <span className="relative inline-flex size-1.5">
      {pill.pulse ? <span className={cn("absolute inset-0 animate-ping rounded-full opacity-75", pill.dot)} /> : null}
      <span className={cn("relative size-1.5 rounded-full", pill.dot)} />
    </span>
    {compact ? <span className="sr-only">{pill.label}</span> : pill.label}
  </span>;
}
