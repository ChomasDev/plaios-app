import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { useHostSettings, useRuntime } from "../../shared/api.js";
import { SNAPPY, rise } from "../../shared/motion.js";
import { Hint } from "../../shared/ui/hint.js";
import { Notice } from "../../shared/ui/notice.js";
import { Page } from "../../shared/ui/page.js";
import { ArchitectureDiagram } from "./architecture/architecture-diagram.js";
import { AttentionSection } from "./attention-section.js";
import { HostSection } from "./host-section.js";
import { LogsTab } from "./logs-tab.js";
import { MachineSection } from "./machine-section.js";
import { PackagesTab } from "./packages-tab.js";
import { RegistrySection } from "./registry-section.js";

type Tab = "overview" | "packages" | "logs";
const TABS: Array<[Tab, string]> = [["overview", "Overview"], ["packages", "Packages"], ["logs", "Logs"]];

export function SettingsView() {
  const [tab, setTab] = useState<Tab>("overview");
  return <Page wide title="Settings" intro="The host itself: health, versions, packages and logs." aside={<Tabs active={tab} onChange={setTab} />}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={tab} {...rise()} exit={{ opacity: 0, y: -4, transition: { duration: 0.15 } }}>
        {tab === "overview" ? <Overview /> : tab === "packages" ? <PackagesTab /> : <LogsTab />}
      </motion.div>
    </AnimatePresence>
  </Page>;
}

function Tabs({ active, onChange }: { active: Tab; onChange(tab: Tab): void }) {
  const failing = useRuntime().data?.components.filter((item) => item.enabled && item.runtimeError).length ?? 0;
  return <div role="tablist" aria-label="Settings sections" className="flex gap-1 rounded-full bg-muted p-1 text-sm">
    {TABS.map(([tab, label]) => <button
      key={tab}
      type="button"
      role="tab"
      aria-selected={tab === active}
      onClick={() => onChange(tab)}
      className="relative rounded-full px-3.5 py-1 text-muted-foreground transition-colors hover:text-foreground aria-selected:text-foreground"
    >
      {tab === active ? <motion.span layoutId="settings-tab-pill" transition={SNAPPY} className="absolute inset-0 rounded-full bg-background shadow-sm" /> : null}
      <span className="relative flex items-center gap-1.5">
        {label}
        {tab === "overview" && failing ? <span className="grid size-4 place-items-center rounded-full bg-destructive text-[10px] text-white">{failing}</span> : null}
      </span>
    </button>)}
  </div>;
}

function Overview() {
  const settings = useHostSettings();
  const runtime = useRuntime();
  if (settings.isError) return <Notice tone="error">Settings unavailable: {settings.error.message}</Notice>;
  if (!settings.data) return <Hint>Loading…</Hint>;
  const data = settings.data;
  return <>
    <div className="max-w-3xl">
      <AttentionSection />
      <HostSection key={data.host.current} host={data.host} />
      <RegistrySection key={data.registry} registry={data.registry} reachable={data.registryReachable} />
      <MachineSection settings={data} />
    </div>
    {runtime.data ? <section className="mt-12">
      <h2 className="text-base font-medium">How it fits together</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Your running components, wired the way a message travels through them.</p>
      <ArchitectureDiagram components={runtime.data.components} />
    </section> : null}
  </>;
}
