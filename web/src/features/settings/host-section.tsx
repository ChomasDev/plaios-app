import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { postJson, reloadWhenBack, requestJson, useRuntimeMutation } from "../../shared/api.js";
import type { HostSettingsDto } from "../../shared/types.js";
import { Notice } from "../../shared/ui/notice.js";
import { PillButton } from "../../shared/ui/pill-button.js";
import { Section } from "../../shared/ui/section.js";
import { VersionSelect } from "./version-select.js";

/** Host version (any published one, older too), plus the two ways to start fresh. */
export function HostSection({ host }: { host: HostSettingsDto["host"] }) {
  const [version, setVersion] = useState(host.latest ?? host.current);
  const [restarting, setRestarting] = useState(false);
  const restartWith = (url: string, body: unknown) => async () => {
    await postJson(url, body);
    setRestarting(true);
    await reloadWhenBack();
  };
  const update = useMutation({ mutationFn: restartWith("/api/settings/update", { version }) });
  const restart = useMutation({ mutationFn: restartWith("/api/settings/restart", {}) });
  const reload = useRuntimeMutation(() => requestJson("/api/runtime/reload", { method: "POST" }));
  const error = update.error ?? restart.error ?? reload.error;
  const busy = restarting || update.isPending || restart.isPending || reload.isPending;
  const hint = host.updateAvailable ? `Installed ${host.current}, ${host.latest} available.` : `Installed ${host.current}. Up to date.`;
  return <Section title="Host" hint={hint}>
    {error ? <Notice tone="error">{error.message}</Notice> : null}
    {restarting ? <Notice>Restarting… the page reloads by itself.</Notice> : null}
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); update.mutate(); }}>
      <VersionSelect name={host.packageName} installed={host.current} latest={host.latest} value={version} onChange={setVersion} disabled={busy} className="h-9 flex-1" />
      <PillButton disabled={busy || !version || version === host.current}>{update.isPending ? "Installing…" : "Install"}</PillButton>
    </form>
    <div className="mt-3 flex flex-wrap gap-1">
      <PillButton quiet disabled={busy} onClick={() => reload.mutate()}>{reload.isPending ? "Reloading…" : "Reload components"}</PillButton>
      <PillButton quiet disabled={busy} onClick={() => { if (window.confirm("Restart the host process?")) restart.mutate(); }}>{restart.isPending ? "Restarting…" : "Restart host"}</PillButton>
    </div>
  </Section>;
}
