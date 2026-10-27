import type { InterfaceKind } from "../../../shared/types.js";

export interface DiagramNode { kind: InterfaceKind; x: number; y: number; w: number; h: number; wide?: boolean }
export interface DiagramEdge { from: InterfaceKind; to: InterfaceKind; d: string; label: string; lx: number; ly: number; quiet?: boolean }

/** Laid out on a 960×540 canvas (drawn from y=50): the message path runs left to right, models below it, the registry above, storage underneath. */
export const NODES: DiagramNode[] = [
  { kind: "input", x: 20, y: 210, w: 150, h: 64 },
  { kind: "memory", x: 215, y: 210, w: 150, h: 64 },
  { kind: "orchestrator", x: 410, y: 210, w: 150, h: 64 },
  { kind: "agent", x: 605, y: 210, w: 150, h: 64 },
  { kind: "output", x: 800, y: 210, w: 140, h: 64 },
  { kind: "discovery", x: 508, y: 60, w: 150, h: 64 },
  { kind: "action", x: 800, y: 60, w: 140, h: 64 },
  { kind: "system1", x: 410, y: 370, w: 150, h: 64 },
  { kind: "system2", x: 605, y: 370, w: 150, h: 64 },
  { kind: "database", x: 20, y: 470, w: 455, h: 50, wide: true },
  { kind: "env", x: 485, y: 470, w: 455, h: 50, wide: true },
];

export const EDGES: DiagramEdge[] = [
  { from: "input", to: "memory", d: "M170 242H213", label: "message", lx: 192, ly: 232 },
  { from: "memory", to: "orchestrator", d: "M365 242H408", label: "+ context", lx: 387, ly: 232 },
  { from: "orchestrator", to: "agent", d: "M560 242H603", label: "decision", lx: 582, ly: 232 },
  { from: "agent", to: "output", d: "M755 242H798", label: "answer", lx: 777, ly: 232 },
  { from: "output", to: "memory", d: "M870 210C870 158 290 158 290 208", label: "saves both turns", lx: 400, ly: 176, quiet: true },
  { from: "discovery", to: "orchestrator", d: "M548 124C548 168 485 166 485 208", label: "searches", lx: 500, ly: 150 },
  { from: "discovery", to: "agent", d: "M618 124C618 168 680 166 680 208", label: "fetches chosen", lx: 690, ly: 150 },
  { from: "agent", to: "action", d: "M735 210C735 140 760 92 798 92", label: "calls", lx: 770, ly: 140 },
  { from: "action", to: "discovery", d: "M800 80H660", label: "registered in", lx: 730, ly: 72, quiet: true },
  { from: "orchestrator", to: "system1", d: "M470 274V368", label: "yes / no scores", lx: 470, ly: 322 },
  { from: "orchestrator", to: "system2", d: "M530 274C530 330 630 318 645 368", label: "fallback", lx: 590, ly: 318 },
  { from: "agent", to: "system2", d: "M700 274V368", label: "reasoning + tools", lx: 700, ly: 322 },
  { from: "memory", to: "database", d: "M290 274V468", label: "graph", lx: 290, ly: 372 },
  { from: "input", to: "database", d: "M95 274V468", label: "cron jobs", lx: 95, ly: 372, quiet: true },
];

/** The one path every message travels, for the pulse that rides along it. */
export const MESSAGE_PATH = "M170 242H800";

export const DESCRIPTIONS: Record<InterfaceKind, string> = {
  input: "Where messages come from: Telegram, the API, cron jobs and this chat. Each runs on its own and restarts a second after it fails.",
  memory: "Before every turn it recalls the session history and relevant facts in parallel. Afterwards it saves both turns and anything worth remembering.",
  orchestrator: "Decides which capabilities the agent may use, where the answer goes, what to remember, and whether the model can be skipped entirely.",
  agent: "Runs the model with the chosen capabilities as functions, for up to 100 steps, or calls a capability directly when the orchestrator says so.",
  output: "Receives the answer. A single output streams it live; several get the finished text, plus any extra copies the orchestrator asked for.",
  discovery: "The registry of every enabled capability. The orchestrator searches it; the agent loop fetches only what was chosen.",
  action: "Capabilities the agent can call: smart home, SSH, web search, the CLI and more. Each one registers itself in discovery.",
  system1: "The fast model. It answers yes/no, choice and score questions as probabilities, so the orchestrator asks it first.",
  system2: "The main generative model. It writes answers and calls tools for the agent loop, and decides for the orchestrator when System 1 cannot.",
  database: "SQLite, split into a private namespace per plugin. Graph memory and cron jobs keep their data here.",
  env: "Configuration and API keys for every plugin, read from the process and .env.",
};
