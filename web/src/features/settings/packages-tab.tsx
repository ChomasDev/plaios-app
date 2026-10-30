import { useQuery } from "@tanstack/react-query";
import { cn } from "@plaios/microfrontend";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";
import { useState } from "react";

import { requestJson, useHostSettings, useRuntime } from "../../shared/api.js";
import { componentHealth, kindLabels, type Health } from "../../shared/health.js";
import { SNAPPY, rise } from "../../shared/motion.js";
import type { HostSettingsDto, InterfaceKind, RuntimeComponentDto, StorePackageDto } from "../../shared/types.js";
import { EmptyState } from "../../shared/ui/empty-state.js";
import { Hint } from "../../shared/ui/hint.js";
import { NoResultsScene, UnpluggedScene } from "../../shared/ui/illustrations.js";
import { Notice } from "../../shared/ui/notice.js";
import { PillButton } from "../../shared/ui/pill-button.js";
import { Section } from "../../shared/ui/section.js";
import { StatusDot } from "../../shared/ui/status-dot.js";
import { PackageIcon } from "../store/package-icon.js";
import { splitName } from "../store/package-format.js";
import { CoreParts } from "./core-parts.js";
import { PackagePanel } from "./package-panel.js";
import { SELECT } from "./version-select.js";

type Filter = "all" | "updates" | "errors" | "off";

/** An installed package with the components it runs and their combined health. */
export interface InstalledPackage { item: StorePackageDto; components: RuntimeComponentDto[]; health: Health }

/** Installed packages as a package manager: searchable list on the left, everything about the selected one on the right. */
export function PackagesTab() {
  const store = useQuery({ queryKey: ["store"], queryFn: () => requestJson<StorePackageDto[]>("/api/store") });
  const components = useRuntime().data?.components ?? [];
  const settings = useHostSettings().data;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [kind, setKind] = useState<InterfaceKind | "">("");
  const [selected, setSelected] = useState<string>();
  const [restarting, setRestarting] = useState<string>();

  if (restarting) return <Notice>Installing {restarting} and restarting the host… the page reloads by itself.</Notice>;
  if (store.isError) return <EmptyState art={<UnpluggedScene />} title="The registry is not answering" hint={store.error.message}><PillButton onClick={() => void store.refetch()}>Try again</PillButton></EmptyState>;
  if (!store.data) return <Hint>Reading the registry…</Hint>;

  const installed: InstalledPackage[] = store.data.filter((item) => item.installed).map((item) => {
    const own = components.filter((component) => component.packageName === item.name);
    return { item, components: own, health: packageHealth(own) };
  }).sort((left, right) => left.item.name.localeCompare(right.item.name));
  const counts: Record<Filter, number> = {
    all: installed.length,
    updates: installed.filter(({ item }) => item.updateAvailable).length,
    errors: installed.filter(({ health }) => health === "error").length,
    off: installed.filter(({ health }) => health === "off").length,
  };
  const needle = query.trim().toLowerCase();
  const visible = installed.filter((entry) =>
    matches(entry, filter) &&
    (!kind || entry.item.kinds.includes(kind)) &&
    (!needle || `${entry.item.name} ${entry.item.description ?? ""} ${entry.components.map(({ instanceId }) => instanceId).join(" ")}`.toLowerCase().includes(needle)));
  const current = visible.find(({ item }) => item.name === selected) ?? visible[0];
  const kinds = [...new Set(installed.flatMap(({ item }) => item.kinds))];

  return <>
    <div className="grid gap-6 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className="min-w-0 space-y-3 lg:sticky lg:top-6 lg:self-start">
        <label className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm focus-within:border-foreground/40">
          <Search className="size-3.5 text-muted-foreground" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search installed packages" className="min-w-0 flex-1 bg-transparent outline-none" aria-label="Search installed packages" />
        </label>
        <div className="flex flex-wrap items-center gap-1 text-xs">
          {(["all", "updates", "errors", "off"] as const).filter((value) => value === "all" || counts[value] > 0).map((value) => <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
            className="relative rounded-full px-2.5 py-1 text-muted-foreground transition-colors hover:text-foreground aria-pressed:text-background"
          >
            {filter === value ? <motion.span layoutId="packages-filter-pill" transition={SNAPPY} className="absolute inset-0 rounded-full bg-foreground" /> : null}
            <span className="relative">{FILTER_LABELS[value]} · {counts[value]}</span>
          </button>)}
          <select value={kind} onChange={(event) => setKind(event.target.value as InterfaceKind | "")} aria-label="Filter by kind" className={cn(SELECT, "ml-auto h-7 font-sans")}>
            <option value="">Every kind</option>
            {kinds.map((value) => <option key={value} value={value}>{kindLabels[value]}</option>)}
          </select>
        </div>
        {visible.length === 0
          ? <EmptyState art={<NoResultsScene />} title="No packages match" hint="Try another word or filter." />
          : <ul className="max-h-[70vh] space-y-0.5 overflow-auto pr-1">
            {visible.map((entry) => <PackageListItem key={entry.item.name} entry={entry} active={entry === current} onSelect={() => setSelected(entry.item.name)} />)}
          </ul>}
      </aside>
      <AnimatePresence mode="wait" initial={false}>
        {current ? <motion.div key={current.item.name} {...rise()} exit={{ opacity: 0, transition: { duration: 0.1 } }} className="min-w-0">
          <PackagePanel entry={current} onRestartHost={setRestarting} />
        </motion.div> : null}
      </AnimatePresence>
    </div>
    {settings ? <div className="mt-12 space-y-8">
      <CoreParts slots={settings.slots} onSelectPackage={(name) => { setQuery(""); setFilter("all"); setKind(""); setSelected(name); window.scrollTo({ top: 0, behavior: "smooth" }); }} />
      <div className="max-w-4xl"><RuntimePackages packages={settings.runtimePackages} /></div>
    </div> : null}
  </>;
}

const FILTER_LABELS: Record<Filter, string> = { all: "All", updates: "Updates", errors: "Errors", off: "Off" };

function matches({ item, health }: InstalledPackage, filter: Filter): boolean {
  if (filter === "updates") return item.updateAvailable;
  if (filter === "errors") return health === "error";
  if (filter === "off") return health === "off";
  return true;
}

/** A package is in error if any running component is, and off only when every component is. */
function packageHealth(components: readonly RuntimeComponentDto[]): Health {
  const states = components.map(componentHealth);
  if (states.includes("error")) return "error";
  if (states.length > 0 && states.every((state) => state === "off")) return "off";
  return "online";
}

function PackageListItem({ entry, active, onSelect }: { entry: InstalledPackage; active: boolean; onSelect(): void }) {
  const { item } = entry;
  const { scope, short } = splitName(item.name);
  return <li>
    <button type="button" onClick={onSelect} aria-current={active} className={cn("relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors", active ? "" : "hover:bg-muted/60")}>
      {active ? <motion.span layoutId="packages-active-row" transition={SNAPPY} className="absolute inset-0 rounded-xl bg-muted" /> : null}
      <span className="relative"><PackageIcon name={item.name} /></span>
      <span className="relative min-w-0 flex-1">
        <span className="flex items-center gap-2"><span className="truncate text-sm font-medium">{short}</span><StatusDot health={entry.health} /></span>
        <span className="block truncate text-xs text-muted-foreground">{scope ? `${scope} · ` : ""}v{item.installedVersion}</span>
      </span>
      {item.updateAvailable ? <span className="relative shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">{item.version}</span> : null}
    </button>
  </li>;
}

function RuntimePackages({ packages }: { packages: HostSettingsDto["runtimePackages"] }) {
  if (packages.length === 0) return null;
  return <Section title="Runtime" hint="Shipped with the host; they move with the host version.">
    <ul className="space-y-1.5 text-sm">
      {packages.map((item) => <li key={item.name} className="flex justify-between gap-4"><span>{item.name}</span><span className="font-mono text-xs text-muted-foreground">{item.current}</span></li>)}
    </ul>
  </Section>;
}
