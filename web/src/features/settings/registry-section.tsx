import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { postJson } from "../../shared/api.js";
import { Notice } from "../../shared/ui/notice.js";
import { PillButton } from "../../shared/ui/pill-button.js";
import { Section } from "../../shared/ui/section.js";

const PRESETS = [
  { label: "Public npm", url: "https://registry.npmjs.org" },
  { label: "Local", url: "http://localhost:4873" },
];

export function RegistrySection({ registry, reachable }: { registry: string; reachable: boolean }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(registry);
  const save = useMutation({ mutationFn: (url: string) => postJson("/api/settings", { registry: url }, "PUT"), onSuccess: () => queryClient.invalidateQueries() });
  const use = (url: string) => { setValue(url); save.mutate(url); };
  return <Section title="Registry" hint={reachable ? "Reachable." : "Unreachable."}>
    {save.error ? <Notice tone="error">{save.error.message}</Notice> : null}
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(value); }}>
      <input value={value} onChange={(event) => setValue(event.target.value)} className="field" aria-label="Registry URL" />
      <PillButton disabled={save.isPending || value === registry}>{save.isPending ? "Saving…" : "Save"}</PillButton>
    </form>
    <div className="mt-2 flex gap-1">
      {PRESETS.map((preset) => <PillButton key={preset.url} quiet disabled={save.isPending || registry === preset.url} onClick={() => use(preset.url)}>
        {registry === preset.url ? `Using ${preset.label}` : `Use ${preset.label}`}
      </PillButton>)}
    </div>
  </Section>;
}
