import { kindLabels } from "../../shared/health.js";
import { kindIcons } from "../../shared/kind-icons.js";
import type { StorePackageDto } from "../../shared/types.js";

export function KindBadges({ item }: { item: StorePackageDto }) {
  return <>{item.kinds.map((kind) => {
    const Icon = kindIcons[kind];
    return <span key={kind} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground"><Icon className="size-3" />{kindLabels[kind]}</span>;
  })}</>;
}

/** Installed and update state, the two things worth seeing before opening a package. */
export function InstallBadge({ item }: { item: StorePackageDto }) {
  if (item.updateAvailable) return <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">Update {item.version}</span>;
  if (item.installed) return <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">Installed</span>;
  return null;
}
