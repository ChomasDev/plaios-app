import { navigate } from "../../app/routes.js";
import { postJson, requestJson, useRuntimeMutation } from "../../shared/api.js";
import { componentHealth, healthLabels } from "../../shared/health.js";
import { TOGGLE_KINDS, type RuntimeComponentDto } from "../../shared/types.js";
import { BackLink } from "../../shared/ui/back-link.js";
import { Notice } from "../../shared/ui/notice.js";
import { StatusDot } from "../../shared/ui/status-dot.js";
import { Surface } from "../surface/surface.js";
import { EnabledSwitch } from "./enabled-switch.js";

export function ComponentPage({ component }: { component: RuntimeComponentDto }) {
  // No page title: the package's own microfrontend names itself.
  return <div className="mx-auto w-full max-w-6xl px-6 py-8">
    <div className="mb-8 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1"><BackLink href="#components" label="Back to Build" /><ComponentMeta component={component} /></div>
      <ComponentStatus component={component} />
    </div>
    {component.runtimeError ? <RuntimeErrorNotice error={component.runtimeError} /> : null}
    {/* The page already frames the surface, so flatten MicrofrontendFrame's own padding and full-height shell. */}
    <div className="[&>div]:min-h-0 [&>div]:p-0"><Surface component={component} /></div>
    <RemoveButton component={component} />
  </div>;
}

function ComponentStatus({ component }: { component: RuntimeComponentDto }) {
  const health = componentHealth(component);
  return <div className="flex items-center gap-4 text-sm">
    <span className="flex items-center gap-2 text-muted-foreground"><StatusDot health={health} />{healthLabels[health]}</span>
    {TOGGLE_KINDS.includes(component.kind) ? <EnabledSwitch component={component} /> : null}
  </div>;
}

function ComponentMeta({ component }: { component: RuntimeComponentDto }) {
  return <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
    <span>{component.packageName} {component.version}</span>
    <span>·</span>
    <span>{component.instanceId}</span>
  </p>;
}

function RuntimeErrorNotice({ error }: { error: string }) {
  const reload = useRuntimeMutation(() => requestJson("/api/runtime/reload", { method: "POST" }));
  return <Notice tone="error">
    <span className="flex-1">{error}</span>
    <button type="button" className="shrink-0 underline-offset-4 hover:underline" disabled={reload.isPending} onClick={() => reload.mutate()}>{reload.isPending ? "Reloading…" : "Retry"}</button>
  </Notice>;
}

function RemoveButton({ component }: { component: RuntimeComponentDto }) {
  const remove = useRuntimeMutation(() => postJson("/api/settings/component", { instanceId: component.instanceId }, "DELETE"));
  const onClick = () => {
    if (!window.confirm(`Remove ${component.instanceId} from this runtime?`)) return;
    remove.mutate(undefined, { onSuccess: () => navigate("components") });
  };
  return <div className="mt-10">
    {remove.error ? <Notice tone="error">{remove.error.message}</Notice> : null}
    <button type="button" className="text-xs text-muted-foreground transition-colors hover:text-destructive" disabled={remove.isPending} onClick={onClick}>
      {remove.isPending ? "Removing…" : "Remove this component"}
    </button>
  </div>;
}
