import { cn } from "@plaios/microfrontend";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X } from "lucide-react";
import { useEffect, useState } from "react";

import { SHEET_EASE } from "../../shared/motion.js";
import type { Step, Turn } from "../conversations/use-conversations.js";
import { focusStep, formatElapsed, pretty } from "./work-log.js";

/**
 * The sub-agents of the latest turn that started any, floating at the right like T3 Code's subagent bar:
 * what each is doing now, for how long, and how many tools it used. Clicking one opens it in the timeline.
 */
export function AgentsPanel({ turns }: { turns: Turn[] }) {
  const turn = [...turns].reverse().find((item) => item.steps?.some(({ kind }) => kind === "agent"));
  const [dismissed, setDismissed] = useState<number>();
  const [expanded, setExpanded] = useState(false);
  const streaming = turn?.streaming === true;
  const now = useTicker(streaming);
  if (!turn || dismissed === turn.id) return null;
  const steps = turn.steps ?? [];
  const agents = steps.filter(({ kind }) => kind === "agent");
  const working = streaming ? agents.filter(({ status }) => status === "running").length : 0;
  const plan = steps.find(({ kind }) => kind === "todo")?.items;

  const list = <div className="space-y-1.5">
    {plan ? <p className="px-1 text-xs text-muted-foreground">Plan {plan.filter(({ status }) => status === "done").length}/{plan.length}</p> : null}
    {agents.map((agent) => <AgentCard key={agent.id} agent={agent} steps={steps} streaming={streaming} now={now} />)}
  </div>;

  return <>
    {/* Wide screens: a floating column beside the chat. */}
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: SHEET_EASE }}
      aria-label="Sub-agents"
      className="fixed top-16 right-4 z-10 hidden max-h-[calc(100svh-10rem)] w-72 flex-col overflow-hidden rounded-2xl border bg-background/85 shadow-lg backdrop-blur 2xl:flex"
    >
      <Header working={working} total={agents.length} onClose={() => setDismissed(turn.id)} />
      <div className="overflow-auto p-2">{list}</div>
    </motion.aside>
    {/* Narrower screens: a pill that opens the same list. */}
    <div className="fixed right-4 bottom-28 z-10 2xl:hidden">
      <AnimatePresence>
        {expanded ? <motion.div key="list" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mb-2 max-h-[60svh] w-72 overflow-auto rounded-2xl border bg-background/95 p-2 shadow-lg backdrop-blur">{list}</motion.div> : null}
      </AnimatePresence>
      <button type="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded} className="ml-auto flex items-center gap-2 rounded-full border bg-background/95 px-3 py-1.5 text-xs shadow-md backdrop-blur">
        <Dot status={working ? "running" : agents.some(({ status }) => status === "failed") ? "failed" : "done"} />
        {working ? `${working} of ${agents.length} agents working` : `${agents.length} agents done`}
      </button>
    </div>
  </>;
}

function Header({ working, total, onClose }: { working: number; total: number; onClose(): void }) {
  return <div className="flex items-center gap-2 border-b px-3 py-2 text-sm">
    <Bot className="size-4 text-muted-foreground" />
    <span className="font-medium">Agents</span>
    <span className="text-xs text-muted-foreground">{working ? `${working} working` : "all done"} · {total}</span>
    <button type="button" onClick={onClose} aria-label="Hide agents" className="ml-auto grid size-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><X className="size-3.5" /></button>
  </div>;
}

function AgentCard({ agent, steps, streaming, now }: { agent: Step; steps: Step[]; streaming: boolean; now: number }) {
  const status = agent.status === "running" && !streaming ? "done" : agent.status;
  const own = steps.filter(({ parentId }) => parentId === agent.id);
  const tools = own.filter(({ kind }) => kind === "tool");
  const failed = tools.filter(({ status: toolStatus }) => toolStatus === "failed").length;
  const latest = own.at(-1);
  const activity = status === "running"
    ? latest ? (latest.kind === "thought" ? "Thinking…" : `${pretty(latest.label)}${latest.detail ? ` ${latest.detail}` : ""}`) : "Starting…"
    : agent.detail;
  const started = agent.startedAt ? Date.parse(agent.startedAt) : undefined;
  const ended = agent.endedAt ? Date.parse(agent.endedAt) : undefined;
  const elapsed = started ? (ended ?? (status === "running" ? now : undefined)) : undefined;
  return <button type="button" onClick={() => focusStep(agent.id)} className="w-full rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-muted/70">
    <span className="flex items-center gap-2">
      <Dot status={status} />
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{agent.label}</span>
      {elapsed !== undefined && started !== undefined ? <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{formatElapsed(elapsed - started)}</span> : null}
    </span>
    {activity ? <span className={cn("mt-0.5 block truncate ps-4 font-mono text-[11px]", status === "running" ? "shimmer-text" : "text-muted-foreground")}>{activity}</span> : null}
    <span className="mt-0.5 block ps-4 text-[11px] text-muted-foreground">{tools.length} tool{tools.length === 1 ? "" : "s"}{failed ? <span className="text-destructive"> · {failed} failed</span> : null}</span>
  </button>;
}

/** T3 Code's colours: sky and pulsing while working, emerald when done, red when failed. */
function Dot({ status }: { status: Step["status"] }) {
  const color = status === "running" ? "bg-sky-500 dark:bg-sky-300/80" : status === "failed" ? "bg-red-500 dark:bg-red-300/90" : "bg-emerald-500 dark:bg-emerald-300/90";
  return <span className="relative inline-flex size-2 shrink-0">
    {status === "running" ? <span className={cn("absolute inset-0 animate-ping rounded-full opacity-75", color)} /> : null}
    <span className={cn("relative size-2 rounded-full", color)} />
  </span>;
}

function useTicker(live: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [live]);
  return live ? now : Date.now();
}
