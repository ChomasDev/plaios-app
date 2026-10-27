import { postJson, useRuntimeMutation } from "../../shared/api.js";
import type { RuntimeComponentDto } from "../../shared/types.js";
import { Switch } from "../../shared/ui/switch.js";

/** Flips immediately and rolls back if the runtime refuses. */
export function EnabledSwitch({ component }: { component: RuntimeComponentDto }) {
  const toggle = useRuntimeMutation((enabled: boolean) => postJson("/api/settings/component", { instanceId: component.instanceId, enabled }));
  const enabled = toggle.isPending ? toggle.variables : component.enabled !== false;
  return <Switch checked={enabled} label={`${component.id} enabled`} disabled={toggle.isPending} onChange={(next) => toggle.mutate(next)} />;
}
