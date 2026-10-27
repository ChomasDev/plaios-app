import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { postJson } from "../../shared/api.js";
import { Notice } from "../../shared/ui/notice.js";
import { PillButton } from "../../shared/ui/pill-button.js";
import { Section } from "../../shared/ui/section.js";

export function RegistrySection({ registry, reachable }: { registry: string; reachable: boolean }) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(registry);
  const save = useMutation({ mutationFn: () => postJson("/api/settings", { registry: value }, "PUT"), onSuccess: () => queryClient.invalidateQueries() });
  return <Section title="Registry" hint={reachable ? "Reachable." : "Unreachable."}>
    {save.error ? <Notice tone="error">{save.error.message}</Notice> : null}
    <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); save.mutate(); }}>
      <input value={value} onChange={(event) => setValue(event.target.value)} className="field" aria-label="Registry URL" />
      <PillButton disabled={save.isPending || value === registry}>{save.isPending ? "Saving…" : "Save"}</PillButton>
    </form>
  </Section>;
}
