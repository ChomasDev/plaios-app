import { motion } from "framer-motion";
import { Clock } from "lucide-react";

import { packageHref } from "../../app/routes.js";
import { rise, SNAPPY, stagger } from "../../shared/motion.js";
import type { StorePackageDto } from "../../shared/types.js";
import { InstallBadge, KindBadges } from "./package-badges.js";
import { splitName, timeAgo } from "./package-format.js";
import { PackageIcon } from "./package-icon.js";

export function PackageCard({ item, index }: { item: StorePackageDto; index: number }) {
  const { scope, short } = splitName(item.name);
  return <motion.li {...rise(stagger(index))} layout="position">
    <motion.a
      href={packageHref(item.name)}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.985 }}
      transition={SNAPPY}
      className="group flex h-full flex-col gap-4 rounded-2xl border bg-background/60 p-5 transition-[border-color,box-shadow] hover:border-foreground/20 hover:shadow-[0_12px_32px_-16px_rgb(0_0_0/0.25)]"
    >
      <div className="flex items-start gap-3">
        <span className="icon-tilt"><PackageIcon name={item.name} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{short}</p>
          <p className="truncate text-xs text-muted-foreground">{scope ?? "unscoped"}</p>
        </div>
        <InstallBadge item={item} />
      </div>
      <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{item.description ?? "No description."}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <KindBadges item={item} />
        <span className="ml-auto flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
          v{item.installedVersion ?? item.version}
          {item.updatedAt ? <><Clock className="ml-1 size-3" />{timeAgo(item.updatedAt)}</> : null}
        </span>
      </div>
    </motion.a>
  </motion.li>;
}
