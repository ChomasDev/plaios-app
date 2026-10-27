import type { ReactNode } from "react";

import { useTelemetry } from "../../shared/api.js";
import { formatBytes, formatDuration } from "../../shared/format.js";
import type { HostSettingsDto } from "../../shared/types.js";
import { Section } from "../../shared/ui/section.js";

export function MachineSection({ settings }: { settings: HostSettingsDto }) {
  const telemetry = useTelemetry().data;
  return <Section title="Machine">
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <Row label="Config">{settings.configPath}</Row>
      <Row label="Listening">{settings.server.host}:{settings.server.port}</Row>
      {telemetry ? <>
        <Row label="Host">{telemetry.host.hostname} · {telemetry.host.platform} · Node {telemetry.host.node}</Row>
        <Row label="Load">{telemetry.host.loadavg[0].toFixed(2)} on {telemetry.host.cpus} cores · {formatBytes(telemetry.host.rss)} used by the process</Row>
        <Row label="Uptime">{formatDuration(telemetry.uptimeSec)} · {telemetry.runs.total} runs, {telemetry.runs.failed} failed</Row>
      </> : null}
    </dl>
  </Section>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return <>
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="truncate tabular-nums">{children}</dd>
  </>;
}
