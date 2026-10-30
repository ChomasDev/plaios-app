import { CircleCheck } from "lucide-react";

import { openComponent } from "../../app/routes.js";
import { requestJson, useRuntime, useRuntimeMutation, useTelemetry } from "../../shared/api.js";
import { formatDate } from "../../shared/format.js";
import { PillButton } from "../../shared/ui/pill-button.js";
import { Section } from "../../shared/ui/section.js";
import { StatusDot } from "../../shared/ui/status-dot.js";

/** Everything that is broken right now, first thing on the page. */
export function AttentionSection() {
  const components = useRuntime().data?.components ?? [];
  const runs = useTelemetry().data?.runs;
  const reload = useRuntimeMutation(() => requestJson("/api/runtime/reload", { method: "POST" }));
  const failing = components.filter((item) => item.enabled && item.runtimeError);
  const failedRuns = (runs?.recent ?? []).filter((run) => !run.ok).slice(-5).reverse();
  const running = components.filter((item) => item.enabled && !item.runtimeError).length;
  const hint = `${running} of ${components.filter((item) => item.enabled).length} components running${runs ? ` · ${runs.failed} of ${runs.total} runs failed` : ""}.`;
  return <Section title="Status" hint={hint}>
    {failing.length === 0 && failedRuns.length === 0
      ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><CircleCheck className="size-4 text-emerald-500" />Everything is running.</p>
      : <ul className="space-y-2">
        {failing.map((item) => <li key={item.instanceId}>
          <button type="button" onClick={() => openComponent(item.instanceId)} className="flex w-full items-start gap-3 rounded-xl bg-destructive/10 px-3 py-2.5 text-left text-sm transition-colors hover:bg-destructive/15">
            <span className="mt-1.5"><StatusDot health="error" /></span>
            <span className="min-w-0">
              <span className="block font-medium">{item.instanceId}</span>
              <span className="block break-words font-mono text-xs text-destructive">{item.runtimeError}</span>
            </span>
          </button>
        </li>)}
        {failedRuns.map((run) => <li key={run.at} className="rounded-xl bg-muted px-3 py-2.5 text-sm">
          <span className="text-xs text-muted-foreground">{formatDate(run.at)} · {run.channel}{run.capabilityIds.length ? ` · ${run.capabilityIds.join(", ")}` : ""}</span>
          <span className="block break-words font-mono text-xs">{run.error ?? "Run failed"}</span>
        </li>)}
      </ul>}
    {failing.length ? <div className="mt-3 flex items-center gap-3">
      <PillButton onClick={() => reload.mutate()} disabled={reload.isPending}>{reload.isPending ? "Reloading…" : "Reload runtime"}</PillButton>
      {reload.error ? <p role="alert" className="text-xs text-destructive">{reload.error.message}</p> : null}
    </div> : null}
  </Section>;
}
