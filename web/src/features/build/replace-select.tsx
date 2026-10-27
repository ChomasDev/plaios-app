import { postJson, useRuntimeMutation } from "../../shared/api.js";
import { kindLabels } from "../../shared/health.js";
import type { InterfaceKind, RuntimeSlotOptionDto } from "../../shared/types.js";
import { TILE } from "./stages.js";

interface Swap { kind: InterfaceKind; packageName: string; version: string }

/** Swaps a core part for another installed package; the runtime reloads afterwards. */
export function ReplaceSelect({ kind, options }: { kind: InterfaceKind; options: RuntimeSlotOptionDto[] }) {
  const swap = useRuntimeMutation((body: Swap) => postJson("/api/settings/swap", body));
  if (!options.length) return null;
  const label = kindLabels[kind].toLowerCase();
  const onChange = (value: string) => {
    const option = options.find((item) => item.packageName === value);
    if (!option) return;
    if (!window.confirm(`Replace the ${label}? The runtime reloads.`)) return;
    swap.mutate({ kind, packageName: option.packageName, version: option.version });
  };
  return <>
  <select
    className={TILE}
    value=""
    disabled={swap.isPending}
    aria-label={`Replace ${label}`}
    onChange={(event) => onChange(event.target.value)}
  >
    <option value="">{swap.isPending ? "Replacing…" : `Replace ${label}…`}</option>
    {options.map((option) => <option key={option.packageName} value={option.packageName}>{option.packageName} {option.version}</option>)}
  </select>
  {swap.error ? <p role="alert" className="basis-full text-xs text-destructive">{swap.error.message}</p> : null}
  </>;
}
