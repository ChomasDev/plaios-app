import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { openComponent } from "../../app/routes.js";
import { rise } from "../../shared/motion.js";
import type { RuntimeComponentDto } from "../../shared/types.js";

/** Frame for a plugin's compact `Chat` export inside an answer. */
export function ChatCard({ component, children }: { component: RuntimeComponentDto; children: ReactNode }) {
  return <motion.section {...rise(0.1)} className="overflow-hidden rounded-2xl border bg-card">
    <header className="flex items-center justify-between border-b px-5 py-2.5">
      <span className="text-sm font-medium">{component.id}</span>
      <button type="button" onClick={() => openComponent(component.instanceId)} className="group flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        Open
        <ArrowUpRight className="icon-nudge-out size-3.5" />
      </button>
    </header>
    {children}
  </motion.section>;
}
