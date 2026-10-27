import { BookMarked, Brain, Compass, Database, Inbox, KeyRound, Route, Send, Workflow, Wrench, Zap, type LucideIcon } from "lucide-react";

import type { InterfaceKind } from "./types.js";

export const kindIcons: Record<InterfaceKind, LucideIcon> = {
  env: KeyRound,
  system1: Zap,
  system2: Brain,
  discovery: Compass,
  database: Database,
  memory: BookMarked,
  orchestrator: Route,
  agent: Workflow,
  input: Inbox,
  output: Send,
  action: Wrench,
};
