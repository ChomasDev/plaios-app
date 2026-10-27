import { postJson, useRuntimeMutation } from "../../shared/api.js";
import type { StorePackageDto } from "../../shared/types.js";
import { PillButton } from "../../shared/ui/pill-button.js";

type StoreAction = "install" | "update" | "uninstall";

export function PackageActions({ item }: { item: StorePackageDto }) {
  const mutation = useRuntimeMutation((action: StoreAction) => postJson(`/api/store/${action}`, { packageName: item.name, version: item.version }));
  const pending = mutation.isPending ? mutation.variables : undefined;
  return <div className="flex flex-col items-end gap-2">
    <ActionButtons item={item} pending={pending} onAction={(action) => mutation.mutate(action)} />
    {mutation.error ? <p role="alert" className="max-w-xs text-right text-xs text-destructive">{mutation.error.message}</p> : null}
  </div>;
}

function ActionButtons({ item, pending, onAction }: { item: StorePackageDto; pending?: StoreAction; onAction(action: StoreAction): void }) {
  const busy = pending !== undefined;
  if (!item.installed) return <PillButton onClick={() => onAction("install")} disabled={busy}>{pending === "install" ? "Installing…" : "Install"}</PillButton>;
  const uninstall = () => { if (window.confirm(`Uninstall ${item.name}?`)) onAction("uninstall"); };
  return <div className="flex items-center gap-1">
    {item.updateAvailable ? <PillButton onClick={() => onAction("update")} disabled={busy}>{pending === "update" ? "Updating…" : `Update to ${item.version}`}</PillButton> : null}
    <PillButton quiet onClick={uninstall} disabled={busy}>{pending === "uninstall" ? "Removing…" : "Uninstall"}</PillButton>
  </div>;
}
