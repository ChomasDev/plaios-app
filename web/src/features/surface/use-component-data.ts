import { useQuery, useQueryClient } from "@tanstack/react-query";

import { postJson, requestJson } from "../../shared/api.js";
import type { BridgeActionMarker, RuntimeComponentDto } from "../../shared/types.js";

export const componentDataKey = (instanceId: string) => ["component-data", instanceId];

/** Live bridge data for a component; bridge actions become async functions that refresh it afterwards. */
export function useComponentData(component: RuntimeComponentDto) {
  const queryClient = useQueryClient();
  const key = componentDataKey(component.instanceId);
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  return useQuery({
    queryKey: key,
    queryFn: async () => hydrateBridge(await requestJson<unknown>(`/api/components/${encodeURIComponent(component.instanceId)}/data`), component.instanceId, refresh),
    enabled: component.hasDataBridge,
  });
}

function hydrateBridge(value: unknown, instanceId: string, afterAction: () => unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => hydrateBridge(item, instanceId, afterAction));
  if (!value || typeof value !== "object") return value;
  if (isActionMarker(value)) return bridgeAction(value.__agentOsAction, instanceId, afterAction);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, hydrateBridge(item, instanceId, afterAction)]));
}

function isActionMarker(value: object): value is BridgeActionMarker {
  return "__agentOsAction" in value && typeof (value as BridgeActionMarker).__agentOsAction === "string";
}

/** Functions under `queries` only read (camera stills, lookups), so they skip the refresh every other action triggers. */
function bridgeAction(path: string, instanceId: string, afterAction: () => unknown) {
  const readOnly = path.startsWith("queries.");
  return async (...args: unknown[]) => {
    const result = await postJson(`/api/components/${encodeURIComponent(instanceId)}/action`, { path, args });
    if (!readOnly) await afterAction();
    return result;
  };
}
