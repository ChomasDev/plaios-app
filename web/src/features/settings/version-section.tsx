import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { postJson, waitForControlPlane } from "../../shared/api.js";
import type { HostSettingsDto, HostUpdateResult } from "../../shared/types.js";
import { Notice } from "../../shared/ui/notice.js";
import { PillButton } from "../../shared/ui/pill-button.js";
import { Section } from "../../shared/ui/section.js";

export function VersionSection({ host }: { host: HostSettingsDto["host"] }) {
  const [version, setVersion] = useState(host.latest ?? host.current);
  const [restarting, setRestarting] = useState(false);
  const update = useMutation({
    mutationFn: () => postJson<HostUpdateResult>("/api/settings/update", { version }),
    onSuccess: async () => { setRestarting(true); await waitForControlPlane(); location.reload(); },
  });
  const hint = host.updateAvailable ? `Installed ${host.current}, ${host.latest} available.` : `Installed ${host.current}. Up to date.`;
  return <Section title="Version" hint={hint}>
    {update.error ? <Notice tone="error">{update.error.message}</Notice> : null}
    {restarting ? <Notice>Restarting… the page reloads by itself.</Notice> : null}
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); update.mutate(); }}>
      <input value={version} onChange={(event) => setVersion(event.target.value)} className="field" aria-label="Version" />
      <PillButton disabled={update.isPending || restarting || !version || version === host.current}>{update.isPending ? "Installing…" : "Install"}</PillButton>
    </form>
  </Section>;
}
