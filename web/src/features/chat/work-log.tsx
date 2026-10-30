import { cn } from "@plaios/microfrontend";
import { AnimatePresence, motion } from "framer-motion";
import { BookMarked, Bot, Brain, Check, ChevronRight, Clock, Code2, Globe, House, LoaderCircle, SquareTerminal, Wrench, X, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { SNAPPY } from "../../shared/motion.js";
import type { PlanItem } from "../../shared/types.js";
import type { Step } from "../conversations/use-conversations.js";

/**
 * What the agent is doing, after T3 Code's timeline: a live "Working" header, then compact rows —
 * thoughts, tool calls (consecutive ones grouped), sub-agents — each opening to its full detail.
 */
export function WorkLog({ steps, streaming, startedAt, endedAt }: { steps: Step[]; streaming: boolean; startedAt?: number; endedAt?: string }) {
  const [open, setOpen] = useState(streaming);
  // Fold once the answer is in, like a finished task; the user can still reopen it.
  useEffect(() => { if (!streaming) setOpen(false); }, [streaming]);
  // The agents panel can ask for one of these steps.
  useFocus((id) => { if (steps.some((step) => step.id === id)) setOpen(true); });
  const now = useNow(streaming);
  // The whole turn, from the question to the end of the answer; steps alone miss the model's own time.
  const started = startedAt ?? earliest(steps.map((step) => step.startedAt));
  const ended = endedAt ? Date.parse(endedAt) : latest(steps.map((step) => step.endedAt));
  const elapsed = started ? (streaming ? now : ended ?? now) - started : undefined;
  const plan = steps.find(({ kind }) => kind === "todo");
  const tools = steps.filter(({ kind }) => kind === "tool" || kind === "agent").length;
  const failed = steps.filter(({ status }) => status === "failed").length;

  return <div className="text-sm">
    <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="group flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
      <motion.span animate={{ rotate: open ? 90 : 0 }} transition={SNAPPY}><ChevronRight className="size-3.5" /></motion.span>
      <span className={streaming ? "shimmer-text" : undefined}>{streaming ? "Working" : "Worked"}{elapsed !== undefined ? ` for ${formatElapsed(elapsed)}` : ""}</span>
      {!streaming && tools ? <span className="text-xs">· {tools} step{tools === 1 ? "" : "s"}{failed ? <span className="text-destructive">, {failed} failed</span> : null}</span> : null}
    </button>
    {plan?.items ? <PlanChecklist items={plan.items} /> : null}
    <AnimatePresence initial={false}>
      {open ? <motion.div key="log" initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
        <Timeline steps={steps} parentId={undefined} streaming={streaming} now={now} />
      </motion.div> : null}
    </AnimatePresence>
  </div>;
}

type Entry = { type: "step"; step: Step } | { type: "group"; steps: Step[] };

/** Rows under one parent, with runs of plain tool calls folded into one group, as T3 Code does with commands. */
function entriesOf(steps: Step[], parentId: string | undefined): Entry[] {
  const own = steps.filter((step) => step.parentId === parentId && step.kind !== "todo" && step.kind !== "plan");
  const entries: Entry[] = [];
  for (const step of own) {
    const groupable = step.kind === "tool" && !steps.some((child) => child.parentId === step.id);
    const last = entries.at(-1);
    if (groupable && last?.type === "group") last.steps.push(step);
    else if (groupable && last?.type === "step" && last.step.kind === "tool" && !steps.some((child) => child.parentId === last.step.id)) entries[entries.length - 1] = { type: "group", steps: [last.step, step] };
    else entries.push({ type: "step", step });
  }
  return entries;
}

function Timeline({ steps, parentId, streaming, now }: { steps: Step[]; parentId: string | undefined; streaming: boolean; now: number }) {
  const entries = entriesOf(steps, parentId);
  if (entries.length === 0) return null;
  return <div className={cn("mt-1 flex min-w-0 flex-col", parentId && "ms-3 border-l ps-3")}>
    {entries.map((entry) => entry.type === "group"
      ? <ToolGroup key={entry.steps[0]!.id} steps={entry.steps} streaming={streaming} now={now} />
      : <StepItem key={entry.step.id} step={entry.step} steps={steps} streaming={streaming} now={now} />)}
  </div>;
}

function ToolGroup({ steps, streaming, now }: { steps: Step[]; streaming: boolean; now: number }) {
  const running = streaming && steps.some(({ status }) => status === "running");
  // Open while its commands run, so the live one shows; folded once they are done.
  const [open, setOpen] = useState(running);
  useEffect(() => { if (!running) setOpen(false); }, [running]);
  const failed = steps.filter(({ status }) => status === "failed").length;
  const names = new Set(steps.map(({ label }) => label));
  const first = steps[0]!;
  const label = names.size > 1 ? `Used ${steps.length} tools` : isCommand(first.label) ? `Ran ${steps.length} commands` : `${pretty(first.label)} · ${steps.length} times`;
  return <div>
    <Row icon={running ? <Spinner /> : <ToolIcon label={first.label} />} open={open} onToggle={() => setOpen(!open)} trailing={failed ? <span className="text-xs text-destructive">{failed} failed</span> : undefined}>
      <span className={running ? "shimmer-text" : undefined}>{label}</span>
    </Row>
    <Collapse open={open}>
      <div className="flex flex-col">{steps.map((step) => <StepItem key={step.id} step={step} steps={steps} streaming={streaming} now={now} />)}</div>
    </Collapse>
  </div>;
}

function StepItem({ step, steps, streaming, now }: { step: Step; steps: Step[]; streaming: boolean; now: number }) {
  // A step still "running" once the turn ended simply finished unreported.
  const status = step.status === "running" && !streaming ? "done" : step.status;
  const running = status === "running";
  const failed = status === "failed";
  const nested = steps.some(({ parentId }) => parentId === step.id);
  // Sub-agents stay open while they work; failures open so the error shows.
  const [open, setOpen] = useState(step.kind === "agent" ? running : failed);
  useEffect(() => { if (step.kind === "agent" && !running) setOpen(false); }, [step.kind, running]);
  const [anchor, setAnchor] = useState<HTMLDivElement | null>(null);
  useFocus((id) => {
    if (id !== step.id) return;
    setOpen(true);
    // After the log and this row have opened.
    setTimeout(() => anchor?.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
  });
  const expandable = nested || Boolean(step.input || step.output);
  const icon = running ? <Spinner /> : failed ? <X className="size-3.5 text-destructive" /> : step.kind === "thought" ? <Brain className="size-3.5" /> : step.kind === "agent" ? <Bot className="size-3.5" /> : <ToolIcon label={step.label} />;
  const started = step.startedAt ? Date.parse(step.startedAt) : undefined;
  const trailing = running && started ? <span className="text-xs tabular-nums">{formatElapsed(now - started)}</span>
    : started ? <span className="text-xs tabular-nums opacity-0 transition-opacity group-hover/row:opacity-100">{CLOCK.format(started)}</span> : undefined;

  return <div ref={setAnchor}>
    <Row icon={icon} open={open} onToggle={expandable ? () => setOpen(!open) : undefined} trailing={trailing}>
      {step.kind === "thought"
        ? <span className={running ? "shimmer-text" : undefined}>{running ? "Thinking" : "Thought"}</span>
        : <>
          <span className={cn(step.kind === "agent" ? "font-medium text-foreground" : "text-foreground/85", running && "shimmer-text")}>{step.kind === "agent" ? step.label : pretty(step.label)}</span>
          {step.detail ? <span className={cn("ms-1.5 font-mono text-xs", failed ? "text-destructive" : "text-muted-foreground")}>{step.detail}</span> : null}
        </>}
    </Row>
    <Collapse open={open && expandable}>
      {nested ? <Timeline steps={steps} parentId={step.id} streaming={streaming} now={now} /> : null}
      <Details step={step} failed={failed} />
    </Collapse>
  </div>;
}

/** Selectable, scrollable detail under a row: thinking as prose, tool input and output as plain monospace, like T3 Code. */
function Details({ step, failed }: { step: Step; failed: boolean }) {
  if (step.kind === "thought") return step.output ? <div className="ms-7 max-h-96 overflow-auto py-1 pe-1 text-[13px] leading-6 whitespace-pre-wrap text-muted-foreground select-text">{step.output.trim()}</div> : null;
  if (!step.input && !step.output) return null;
  return <div className="ms-7 flex max-h-96 flex-col gap-3 overflow-auto py-1.5 pe-1 font-mono text-xs leading-5 select-text">
    {step.input ? <pre className="break-words whitespace-pre-wrap text-foreground/90">{formatInput(step)}</pre> : null}
    {step.output ? <pre className={cn("break-words whitespace-pre-wrap", failed ? "text-destructive" : "text-muted-foreground")}>{step.output}</pre> : null}
  </div>;
}

function Row({ icon, open, onToggle, trailing, children }: { icon: ReactNode; open: boolean; onToggle?: () => void; trailing?: ReactNode; children: ReactNode }) {
  return <button
    type="button"
    disabled={!onToggle}
    aria-expanded={onToggle ? open : undefined}
    onClick={onToggle}
    className="group/row flex min-h-7 w-full min-w-0 items-center gap-1.5 rounded-md px-0.5 text-left text-muted-foreground transition-colors enabled:hover:text-foreground"
  >
    <span className="grid size-6 shrink-0 place-items-center">{icon}</span>
    <span className="min-w-0 flex-1 truncate">{children}</span>
    {trailing}
    {onToggle ? <ChevronRight className={cn("size-3.5 shrink-0 opacity-0 transition-[transform,opacity] group-hover/row:opacity-100", open && "rotate-90 opacity-100")} /> : null}
  </button>;
}

function Collapse({ open, children }: { open: boolean; children: ReactNode }) {
  return <AnimatePresence initial={false}>
    {open ? <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">{children}</motion.div> : null}
  </AnimatePresence>;
}

function Spinner() {
  return <LoaderCircle aria-label="Running" className="size-3.5 animate-spin" />;
}

/** A glyph per kind of tool, guessed from its name, as T3 Code shows a terminal for commands. */
function ToolIcon({ label }: { label: string }) {
  const Icon: LucideIcon = isCommand(label) ? SquareTerminal
    : /search|web|browse|fetch/i.test(label) ? Globe
    : /memory|conversation|retrieval/i.test(label) ? BookMarked
    : /home|light|assistant|device/i.test(label) ? House
    : /cron|schedule/i.test(label) ? Clock
    : /t3|code|repo/i.test(label) ? Code2
    : Wrench;
  return <Icon className="size-3.5" />;
}

function isCommand(label: string): boolean {
  return /cli|command|shell|ssh|exec|terminal/i.test(label);
}

/** A command call reads as the command line; anything else as its JSON. */
function formatInput(step: Step): string {
  try {
    const value = JSON.parse(step.input ?? "") as { command?: unknown; args?: unknown };
    if (typeof value?.command === "string") return `$ ${[value.command, ...(Array.isArray(value.args) ? value.args.map(String) : [])].join(" ")}`;
  } catch { /* not JSON: show as is */ }
  return step.input ?? "";
}

const FOCUS_EVENT = "plaios:focus-step";

/** Opens the work log at one step, from outside it (the agents panel). */
export function focusStep(id: string): void {
  window.dispatchEvent(new CustomEvent(FOCUS_EVENT, { detail: id }));
}

function useFocus(onFocus: (id: string) => void): void {
  const handler = useRef(onFocus);
  handler.current = onFocus;
  useEffect(() => {
    const listener = (event: Event) => handler.current(String((event as CustomEvent).detail));
    window.addEventListener(FOCUS_EVENT, listener);
    return () => window.removeEventListener(FOCUS_EVENT, listener);
  }, []);
}

/** `web_search` → "Web search". */
export function pretty(label: string): string {
  const words = label.replace(/[_.-]+/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const CLOCK = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** The agent's own checklist, pinned above the log, like T3 Code's plan. */
function PlanChecklist({ items }: { items: PlanItem[] }) {
  const done = items.filter(({ status }) => status === "done").length;
  return <div className="my-2 rounded-xl border px-3 py-2.5">
    <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
      <span className="font-medium text-foreground">Plan</span>
      <span className="tabular-nums">{done}/{items.length}</span>
    </div>
    <div className="mb-2 h-1 overflow-hidden rounded-full bg-muted">
      <motion.div className="h-full rounded-full bg-foreground" initial={false} animate={{ width: `${(done / items.length) * 100}%` }} transition={SNAPPY} />
    </div>
    <ul className="space-y-1">
      {items.map((item, index) => <li key={index} className="flex items-start gap-2">
        <span className="mt-[3px] grid size-3.5 shrink-0 place-items-center rounded-full border">
          {item.status === "done" ? <Check className="size-2.5" /> : item.status === "in_progress" ? <span className="size-1.5 animate-pulse rounded-full bg-foreground" /> : null}
        </span>
        <span className={cn(item.status === "done" && "text-muted-foreground line-through", item.status === "in_progress" && "shimmer-text font-medium")}>{item.text}</span>
      </li>)}
    </ul>
  </div>;
}

/** Re-renders every second while `live`, for running timers. */
function useNow(live: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [live]);
  return live ? now : Date.now();
}

function earliest(values: Array<string | undefined>): number | undefined {
  const times = values.flatMap((value) => value ? [Date.parse(value)] : []);
  return times.length ? Math.min(...times) : undefined;
}

function latest(values: Array<string | undefined>): number | undefined {
  const times = values.flatMap((value) => value ? [Date.parse(value)] : []);
  return times.length ? Math.max(...times) : undefined;
}

export function formatElapsed(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1_000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
}
