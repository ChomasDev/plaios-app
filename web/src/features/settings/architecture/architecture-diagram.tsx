import { cn } from "@plaios/microfrontend";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { openComponent } from "../../../app/routes.js";
import { componentHealth, kindLabels } from "../../../shared/health.js";
import { kindIcons } from "../../../shared/kind-icons.js";
import { EASE_OUT } from "../../../shared/motion.js";
import type { InterfaceKind, RuntimeComponentDto } from "../../../shared/types.js";
import { StatusDot } from "../../../shared/ui/status-dot.js";
import { DESCRIPTIONS, EDGES, MESSAGE_PATH, NODES, type DiagramEdge, type DiagramNode } from "./architecture-model.js";

/** The live wiring: every kind with what is installed in it; pointing at one lights up who it talks to and why. */
export function ArchitectureDiagram({ components }: { components: RuntimeComponentDto[] }) {
  const [active, setActive] = useState<InterfaceKind>();
  const installed = (kind: InterfaceKind) => components.filter((item) => item.kind === kind);
  const linked = (edge: DiagramEdge) => edge.from === active || edge.to === active;
  const near = (kind: InterfaceKind) => !active || kind === active || EDGES.some((edge) => linked(edge) && (edge.from === kind || edge.to === kind));

  return <div>
    <div className="-mx-6 overflow-x-auto px-6">
      <svg viewBox="0 50 960 480" className="h-auto w-full min-w-[720px] select-none" onMouseLeave={() => setActive(undefined)}>
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9Z" className="fill-foreground/30" /></marker>
          <marker id="arch-arrow-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9Z" className="fill-primary" /></marker>
        </defs>
        {EDGES.map((edge, index) => <Edge key={`${edge.from}-${edge.to}`} edge={edge} index={index} on={linked(edge)} dim={Boolean(active) && !linked(edge)} />)}
        <circle r="4" className="flow-pulse fill-primary"><animateMotion dur="3.6s" repeatCount="indefinite" path={MESSAGE_PATH} /></circle>
        <circle r="3" className="flow-pulse fill-primary/60"><animateMotion dur="3.6s" begin="1.8s" repeatCount="indefinite" path={MESSAGE_PATH} /></circle>
        {NODES.map((node, index) => <Node
          key={node.kind}
          node={node}
          index={index}
          components={installed(node.kind)}
          active={active === node.kind}
          dim={!near(node.kind)}
          onActivate={() => setActive(node.kind)}
        />)}
      </svg>
    </div>
    <Explanation kind={active} components={active ? installed(active) : []} />
  </div>;
}

function Edge({ edge, index, on, dim }: { edge: DiagramEdge; index: number; on: boolean; dim: boolean }) {
  return <g className="transition-opacity duration-300" opacity={dim ? 0.25 : 1}>
    <motion.path
      d={edge.d}
      fill="none"
      strokeWidth={on ? 2 : 1.5}
      markerEnd={on ? "url(#arch-arrow-on)" : "url(#arch-arrow)"}
      className={cn("transition-colors duration-300", on ? "stroke-primary" : edge.quiet ? "stroke-foreground/15" : "stroke-foreground/25")}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 1 }}
      transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.25 + index * 0.04 }}
    />
    {on ? <path d={edge.d} fill="none" strokeWidth="2" strokeDasharray="4 6" className="flow-dash stroke-primary-foreground/70" /> : null}
    <AnimatePresence>
      {on ? <motion.text
        x={edge.lx} y={edge.ly} textAnchor="middle"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        stroke="var(--background)" strokeWidth="5" paintOrder="stroke"
        className="fill-primary text-[11px] font-medium"
      >{edge.label}</motion.text> : null}
    </AnimatePresence>
  </g>;
}

function Node({ node, index, components, active, dim, onActivate }: { node: DiagramNode; index: number; components: RuntimeComponentDto[]; active: boolean; dim: boolean; onActivate(): void }) {
  const Icon = kindIcons[node.kind];
  const empty = components.length === 0;
  const open = () => { if (components[0]) openComponent(components[0].instanceId); };
  const iconY = node.y + (node.h - 30) / 2;
  return <motion.g
    role="button"
    tabIndex={0}
    aria-label={`${kindLabels[node.kind]}: ${summary(components)}`}
    onMouseEnter={onActivate}
    onFocus={onActivate}
    onClick={open}
    onKeyDown={(event) => { if (event.key === "Enter") open(); }}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: dim ? 0.35 : 1, y: 0 }}
    transition={{ duration: 0.45, ease: EASE_OUT, delay: index * 0.035 }}
    className={cn("cursor-pointer outline-none", empty && "cursor-default")}
  >
    <rect
      x={node.x} y={node.y} width={node.w} height={node.h} rx="16"
      strokeWidth={active ? 2 : 1.5}
      strokeDasharray={empty ? "5 5" : undefined}
      className={cn("transition-colors duration-300", active ? "fill-primary/10 stroke-primary" : "fill-background stroke-foreground/15")}
    />
    <rect x={node.x + 12} y={iconY} width="30" height="30" rx="9" className={cn("transition-colors duration-300", active ? "fill-primary" : "fill-primary/12")} />
    <Icon x={node.x + 19} y={iconY + 7} width={16} height={16} strokeWidth={2} className={cn("transition-colors duration-300", active ? "text-primary-foreground" : "text-primary")} />
    <text x={node.x + 52} y={node.wide ? node.y + 22 : node.y + 28} className="fill-foreground text-[13px] font-medium">{kindLabels[node.kind]}</text>
    <text x={node.x + 52} y={node.wide ? node.y + 38 : node.y + 46} className="fill-muted-foreground text-[11px]">{clip(summary(components), node.wide ? 60 : 17)}</text>
  </motion.g>;
}

function Explanation({ kind, components }: { kind?: InterfaceKind; components: RuntimeComponentDto[] }) {
  return <div className="mt-4 min-h-28 rounded-2xl border bg-background/60 p-5">
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={kind ?? "intro"} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.18, ease: EASE_OUT }}>
        {kind ? <KindDetail kind={kind} components={components} /> : <Intro />}
      </motion.div>
    </AnimatePresence>
  </div>;
}

function Intro() {
  return <>
    <p className="font-medium">One message, start to finish</p>
    <p className="mt-1 text-sm text-muted-foreground">An input hands the message to memory, which adds what it remembers. The orchestrator picks the tools and the destination, asking the fast model first. The agent loop works it out with the main model and the chosen actions, then the outputs deliver the answer and memory keeps the turn. Point at any part to see what it does.</p>
  </>;
}

function KindDetail({ kind, components }: { kind: InterfaceKind; components: RuntimeComponentDto[] }) {
  const Icon = kindIcons[kind];
  return <div className="flex items-start gap-4">
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground"><Icon className="size-5" /></span>
    <div className="min-w-0 flex-1">
      <p className="font-medium">{kindLabels[kind]}</p>
      <p className="mt-1 text-sm text-muted-foreground">{DESCRIPTIONS[kind]}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {components.length === 0 ? <span className="text-xs text-muted-foreground">Nothing installed here.</span> : null}
        {components.map((item) => <button key={item.instanceId} type="button" onClick={() => openComponent(item.instanceId)} className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors hover:border-foreground/30 hover:bg-muted">
          <StatusDot health={componentHealth(item)} />{item.id}
        </button>)}
      </div>
    </div>
  </div>;
}

function summary(components: RuntimeComponentDto[]): string {
  if (components.length === 0) return "not installed";
  if (components.length === 1) return components[0]!.id;
  return `${components[0]!.id} +${components.length - 1}`;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
