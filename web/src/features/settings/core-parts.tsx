import { cn } from "@plaios/microfrontend";
import { motion } from "framer-motion";
import { ArrowRightLeft, Settings2 } from "lucide-react";

import { postJson, useRuntime, useRuntimeMutation } from "../../shared/api.js";
import { componentHealth, healthLabels, kindLabels, type Health } from "../../shared/health.js";
import { kindIcons } from "../../shared/kind-icons.js";
import { rise, stagger } from "../../shared/motion.js";
import type { HostSettingsDto, InterfaceKind, RuntimeSlotDto, RuntimeSlotOptionDto } from "../../shared/types.js";
import { StatusDot } from "../../shared/ui/status-dot.js";
import { splitName } from "../store/package-format.js";

/** In the order a message meets them. */
const ORDER: InterfaceKind[] = ["env", "database", "memory", "discovery", "system1", "system2", "orchestrator", "agent"];
const PURPOSE: Partial<Record<InterfaceKind, string>> = {
  env: "Settings and secrets every part reads.",
  database: "Where components keep their tables.",
  memory: "What the agent remembers between chats.",
  discovery: "The catalog the agent searches for tools.",
  system1: "Fast model for quick routing decisions.",
  system2: "The model that thinks and writes answers.",
  orchestrator: "Routes each message and picks the tools.",
  agent: "Runs the loop between the model and its tools.",
};

/** The parts the agent cannot run without: what fills each one, whether it is healthy, and what could replace it. */
export function CoreParts({ slots, onSelectPackage }: { slots: HostSettingsDto["slots"]; onSelectPackage(name: string): void }) {
  const parts = ORDER.flatMap((kind) => slots.filter((slot) => slot.kind === kind));
  if (parts.length === 0) return null;
  return <section>
    <h2 className="text-base font-medium">Core parts</h2>
    <p className="mt-1 mb-4 text-sm text-muted-foreground">One package fills each part. Swapping installs the other package, keeps the settings both share, and reloads every component.</p>
    <ul className="grid gap-3 md:grid-cols-2">
      {parts.map((slot, index) => <PartCard key={slot.kind} slot={slot} index={index} onSelectPackage={onSelectPackage} />)}
    </ul>
  </section>;
}

function PartCard({ slot, index, onSelectPackage }: { slot: RuntimeSlotDto; index: number; onSelectPackage(name: string): void }) {
  const components = useRuntime().data?.components ?? [];
  const swap = useRuntimeMutation((option: RuntimeSlotOptionDto) => postJson("/api/settings/swap", { kind: slot.kind, packageName: option.packageName, version: option.version }));
  const Icon = kindIcons[slot.kind];
  const packages = [...new Set(slot.current.map(({ packageName }) => packageName))];
  const running = components.filter((component) => slot.current.some(({ instanceId }) => instanceId === component.instanceId));
  const health: Health = running.some((component) => componentHealth(component) === "error") ? "error" : packages.length ? "online" : "off";
  const alternatives = slot.options.filter((option) => !packages.includes(option.packageName));
  const pending = swap.isPending ? swap.variables : undefined;
  const choose = useRuntimeMutation((instanceId: string) => postJson("/api/settings/active", { kind: slot.kind, instanceId }));
  const choosable = slot.kind === "system1" || slot.kind === "system2";
  const several = slot.current.length > 1 && slot.active !== undefined;
  const onSwap = (option: RuntimeSlotOptionDto) => {
    if (window.confirm(`Use ${option.packageName} as ${kindLabels[slot.kind].toLowerCase()} instead of ${packages.join(", ") || "nothing"}? Every component reloads.`)) swap.mutate(option);
  };

  return <motion.li {...rise(stagger(index))} className="flex flex-col rounded-2xl border p-4">
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted"><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium">{kindLabels[slot.kind]}</h3>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><StatusDot health={health} />{packages.length ? healthLabels[health] : "Empty"}</span>
        </div>
        <p className="text-xs text-muted-foreground">{PURPOSE[slot.kind]}</p>
      </div>
    </div>

    <div className="mt-3 space-y-1">
      {packages.length === 0 ? <p className="text-sm text-muted-foreground">Nothing fills this part.</p> : packages.map((name) => {
        const instances = slot.current.filter((item) => item.packageName === name);
        const inUse = instances.some(({ instanceId }) => instanceId === slot.active);
        return <div key={name} className={cn("flex items-center gap-2 rounded-xl px-3 py-2 transition-colors", several && inUse ? "bg-muted ring-1 ring-foreground/15" : "bg-muted/50")}>
          <button type="button" onClick={() => onSelectPackage(name)} className="min-w-0 flex-1 text-left" title="Show in the package list">
            <span className="block truncate text-sm font-medium hover:underline">{splitName(name).short}</span>
            <span className="block truncate font-mono text-[11px] text-muted-foreground">v{instances[0]?.version}{instances.length > 1 ? ` · ${instances.length} instances` : ""}</span>
          </button>
          {several ? inUse
            ? <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">In use</span>
            : choosable
              ? <button type="button" disabled={choose.isPending} onClick={() => choose.mutate(instances[0]!.instanceId)} className="shrink-0 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:opacity-40">{choose.isPending && choose.variables === instances[0]!.instanceId ? "Switching…" : "Use this"}</button>
              : <span className="shrink-0 text-[11px] text-muted-foreground" title="The runtime uses only one; remove the extra or swap.">Ignored</span>
            : null}
          <a href={`#component/${encodeURIComponent(instances[0]!.instanceId)}`} aria-label={`Configure ${name}`} title="Configure" className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"><Settings2 className="size-3.5" /></a>
        </div>;
      })}
      {running.filter((component) => component.runtimeError).map((component) => <p key={component.instanceId} className="break-words rounded-lg bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">{component.runtimeError}</p>)}
    </div>

    <div className="mt-auto pt-3">
      {alternatives.length === 0
        ? <p className="text-xs text-muted-foreground">No other package in the registry can fill this part.</p>
        : <>
          <p className="mb-1.5 text-xs text-muted-foreground">Can be replaced by</p>
          <ul className="space-y-1">
            {alternatives.map((option) => <li key={option.packageName} className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{splitName(option.packageName).short} <span className="font-mono text-[11px] text-muted-foreground">v{option.version}</span></p>
                {option.description ? <p className="truncate text-xs text-muted-foreground" title={option.description}>{option.description}</p> : null}
              </div>
              <button type="button" disabled={swap.isPending} onClick={() => onSwap(option)} className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40">
                <ArrowRightLeft className="size-3" />{pending?.packageName === option.packageName ? "Swapping…" : "Use instead"}
              </button>
            </li>)}
          </ul>
        </>}
      {several && choosable ? <p className="mt-2 text-xs text-muted-foreground">Components that name their own {kindLabels[slot.kind].toLowerCase()} keep it; switching reloads every component.</p> : null}
      {(swap.error ?? choose.error) ? <p role="alert" className="mt-2 text-xs text-destructive">{(swap.error ?? choose.error)!.message}</p> : null}
    </div>
  </motion.li>;
}
