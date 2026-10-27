import type { InterfaceKind, RuntimeComponentDto } from "./types.js";

export type Health = "online" | "error" | "off";

export const healthLabels: Record<Health, string> = { online: "Running", off: "Off", error: "Needs attention" };

export const kindLabels: Record<InterfaceKind, string> = { env: "Environment", system1: "Fast model", system2: "Model", discovery: "Discovery", database: "Database", memory: "Memory", orchestrator: "Orchestrator", agent: "Agent loop", input: "Inputs", output: "Outputs", action: "Actions" };

export function componentHealth(component: Pick<RuntimeComponentDto, "enabled" | "runtimeError">): Health {
  if (component.enabled === false) return "off";
  if (component.runtimeError) return "error";
  return "online";
}
