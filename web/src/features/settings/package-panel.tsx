import { useMutation } from "@tanstack/react-query";
import { ExternalLink, RotateCw, Settings2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { packageHref } from "../../app/routes.js";
import { postJson, reloadWhenBack, usePackageDetail, useRuntimeMutation } from "../../shared/api.js";
import { componentHealth, healthLabels, kindLabels } from "../../shared/health.js";
import { CORE_KINDS, TOGGLE_KINDS, type RuntimeComponentDto } from "../../shared/types.js";
import { PillButton } from "../../shared/ui/pill-button.js";
import { StatusDot } from "../../shared/ui/status-dot.js";
import { EnabledSwitch } from "../build/enabled-switch.js";
import { InstallBadge, KindBadges } from "../store/package-badges.js";
import { formatBytes, splitName, timeAgo } from "../store/package-format.js";
import { PackageIcon } from "../store/package-icon.js";
import type { InstalledPackage } from "./packages-tab.js";
import { VersionSelect } from "./version-select.js";

const VISIBLE_VERSIONS = 6;

/** Everything about one installed package and every way to act on it. */
export function PackagePanel({ entry, onRestartHost }: { entry: InstalledPackage; onRestartHost(label: string): void }) {
  const { item, components } = entry;
  const detail = usePackageDetail(item.name).data;
  const { scope, short } = splitName(item.name);
  const [version, setVersion] = useState(item.version);
  const install = useMutation({
    mutationFn: async () => {
      await postJson("/api/store/update", { packageName: item.name, version });
      onRestartHost(`${item.name}@${version}`);
      await reloadWhenBack();
    },
  });
  const restart = useRuntimeMutation(() => postJson("/api/components/restart", { instanceIds: components.map(({ instanceId }) => instanceId) }));
  const uninstall = useRuntimeMutation(() => postJson("/api/store/uninstall", { packageName: item.name }));
  const core = item.kinds.some((kind) => CORE_KINDS.includes(kind));
  const error = install.error ?? restart.error ?? uninstall.error;
  const busy = install.isPending || restart.isPending || uninstall.isPending;
  const onInstall = () => { if (window.confirm(`Install ${item.name}@${version}? The host restarts.`)) install.mutate(); };
  const onUninstall = () => {
    const warning = core ? " It is a core part: the agent may stop answering until you add another." : "";
    if (window.confirm(`Uninstall ${item.name} and its ${components.length} component(s)?${warning}`)) uninstall.mutate();
  };

  return <div className="space-y-8">
    <header className="flex flex-wrap items-start gap-4">
      <PackageIcon large name={item.name} />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{scope}</p>
        <h2 className="truncate text-2xl font-semibold tracking-tight">{short}</h2>
        {item.description ? <p className="mt-1 text-sm text-muted-foreground">{item.description}</p> : null}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs text-muted-foreground">v{item.installedVersion}</span>
          <InstallBadge item={item} />
          <KindBadges item={item} />
        </div>
      </div>
    </header>

    <div className="space-y-3 rounded-2xl border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <VersionSelect name={item.name} installed={item.installedVersion} latest={item.version} value={version} onChange={setVersion} disabled={busy} className="h-9 flex-1" />
        <PillButton onClick={onInstall} disabled={busy || version === item.installedVersion}>
          {install.isPending ? "Installing…" : version === item.installedVersion ? "Installed" : version === item.version && item.updateAvailable ? "Update" : "Install version"}
        </PillButton>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <PillButton quiet onClick={() => restart.mutate()} disabled={busy || components.length === 0}>{restart.isPending ? "Restarting…" : core ? "Restart (reloads all)" : "Restart"}</PillButton>
        <PillButton quiet onClick={onUninstall} disabled={busy}>{uninstall.isPending ? "Uninstalling…" : "Uninstall"}</PillButton>
        <a href={packageHref(item.name)} className="ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><ExternalLink className="size-3.5" />README</a>
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error.message}</p> : null}
      <p className="text-xs text-muted-foreground">Another version restarts the host. Restart re-creates only this package's components{core ? "; core parts reload every component" : ""}.</p>
    </div>

    <Block title={`Components · ${components.length}`}>
      {components.length === 0 ? <p className="text-sm text-muted-foreground">Nothing from this package is running.</p> : <ul className="divide-y rounded-2xl border">
        {components.map((component) => <ComponentRow key={component.instanceId} component={component} />)}
      </ul>}
    </Block>

    <div className="grid gap-8 sm:grid-cols-2">
      <Block title="Details"><Facts rows={[
        ["Installed", item.installedVersion && `v${item.installedVersion}`],
        ["Latest", `v${item.version}`],
        ["Published", timeAgo(item.updatedAt)],
        ["License", detail?.license],
        ["Author", detail?.author],
        ["Size", formatBytes(detail?.unpackedSize)],
        ["Files", detail?.fileCount?.toString()],
        ["Dependencies", detail ? String(detail.dependencies.length + detail.peerDependencies.length) : undefined],
      ]} />
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {[["Repository", detail?.repository], ["Homepage", detail?.homepage]].filter((link): link is [string, string] => Boolean(link[1])).map(([label, href]) =>
            <a key={label} href={href} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-muted-foreground hover:text-foreground"><ExternalLink className="size-3.5" />{label}</a>)}
        </div>
      </Block>
      <Block title={`Versions${detail ? ` · ${detail.versions.length}` : ""}`}>
        <ul className="space-y-1">
          {(detail?.versions ?? []).slice(0, VISIBLE_VERSIONS).map((entry) => <li key={entry.version}>
            <button type="button" onClick={() => setVersion(entry.version)} className="flex w-full items-baseline justify-between gap-3 rounded-lg px-2 py-1 text-left transition-colors hover:bg-muted aria-pressed:bg-muted" aria-pressed={entry.version === version}>
              <span className="font-mono text-xs">{entry.version}{entry.version === item.installedVersion ? <span className="text-muted-foreground"> · installed</span> : null}</span>
              <span className="text-xs text-muted-foreground">{timeAgo(entry.date)}</span>
            </button>
          </li>)}
        </ul>
      </Block>
    </div>
  </div>;
}

function ComponentRow({ component }: { component: RuntimeComponentDto }) {
  const restart = useRuntimeMutation(() => postJson("/api/components/restart", { instanceIds: [component.instanceId] }));
  const health = componentHealth(component);
  const core = !TOGGLE_KINDS.includes(component.kind);
  return <li className="px-4 py-3">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <StatusDot health={health} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-mono text-xs">{component.instanceId}</p>
        <p className="text-xs text-muted-foreground">{kindLabels[component.kind]}{component.channel ? ` · channel ${component.channel}` : ""} · {healthLabels[health]}</p>
      </div>
      <div className="flex items-center gap-1">
        {TOGGLE_KINDS.includes(component.kind) ? <EnabledSwitch component={component} /> : null}
        <IconButton label={core ? "Restart (reloads every component)" : "Restart"} disabled={restart.isPending || !component.enabled} onClick={() => restart.mutate()}>
          <RotateCw className={restart.isPending ? "size-3.5 animate-spin" : "size-3.5"} />
        </IconButton>
        <a href={`#component/${encodeURIComponent(component.instanceId)}`} aria-label="Configure" title="Configure" className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"><Settings2 className="size-3.5" /></a>
      </div>
    </div>
    {component.runtimeError ? <p className="mt-2 break-words rounded-lg bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">{component.runtimeError}</p> : null}
    {restart.error ? <p role="alert" className="mt-2 text-xs text-destructive">{restart.error.message}</p> : null}
  </li>;
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick(): void; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40">{children}</button>;
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return <section>
    <h3 className="mb-3 text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h3>
    {children}
  </section>;
}

function Facts({ rows }: { rows: Array<[string, string | undefined]> }) {
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
    {rows.filter((row): row is [string, string] => Boolean(row[1])).map(([label, value]) => <div key={label} className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>)}
  </dl>;
}
