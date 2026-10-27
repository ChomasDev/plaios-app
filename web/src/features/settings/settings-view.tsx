import { useHostSettings, useRuntime } from "../../shared/api.js";
import { Hint } from "../../shared/ui/hint.js";
import { Notice } from "../../shared/ui/notice.js";
import { Page } from "../../shared/ui/page.js";
import { ArchitectureDiagram } from "./architecture/architecture-diagram.js";
import { MachineSection } from "./machine-section.js";
import { RegistrySection } from "./registry-section.js";
import { VersionSection } from "./version-section.js";

export function SettingsView() {
  return <Page wide title="Settings" intro="The host itself. Each plugin's own settings live on its component page.">
    <Architecture />
    <div className="max-w-3xl"><SettingsBody /></div>
  </Page>;
}

function Architecture() {
  const runtime = useRuntime();
  if (!runtime.data) return null;
  return <section className="mb-12">
    <h2 className="text-base font-medium">How it fits together</h2>
    <p className="mt-1 mb-4 text-sm text-muted-foreground">Your running components, wired the way a message travels through them.</p>
    <ArchitectureDiagram components={runtime.data.components} />
  </section>;
}

function SettingsBody() {
  const settings = useHostSettings();
  if (settings.isError) return <Notice tone="error">Settings unavailable: {settings.error.message}</Notice>;
  if (!settings.data) return <Hint>Loading…</Hint>;
  const data = settings.data;
  return <>
    <VersionSection key={data.host.latest ?? data.host.current} host={data.host} />
    <RegistrySection key={data.registry} registry={data.registry} reachable={data.registryReachable} />
    <MachineSection settings={data} />
  </>;
}
