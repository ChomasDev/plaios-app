import type { InterfaceKind } from "../../shared/types.js";

export interface StageSpec { title: string; hint: string; kinds: InterfaceKind[] }

/** The agent as a stack you assemble: what comes in, who decides, who thinks, what it can do, what it remembers, where it answers. */
export const STAGES: StageSpec[] = [
  { title: "Listens on", hint: "Where messages come from", kinds: ["input"] },
  { title: "Decides with", hint: "Routes each message and picks tools", kinds: ["orchestrator", "system1"] },
  { title: "Thinks with", hint: "The model that writes answers", kinds: ["system2", "agent"] },
  { title: "Can do", hint: "Tools the agent may call", kinds: ["action"] },
  { title: "Remembers in", hint: "Memory, storage and the tool catalog", kinds: ["memory", "database", "discovery"] },
  { title: "Answers on", hint: "Where replies are delivered", kinds: ["output"] },
  { title: "Runs with", hint: "Environment and secrets", kinds: ["env"] },
];

/** Dashed tile shared by the "add" link and the "replace" picker. */
export const TILE = "grid min-w-28 place-items-center rounded-2xl border border-dashed px-4 py-3 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground disabled:opacity-50";
