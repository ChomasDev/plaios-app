import { cn } from "@agent-os/microfrontend";
import { motion } from "framer-motion";

import { openComponent } from "../../app/routes.js";
import { componentHealth } from "../../shared/health.js";
import { TOGGLE_KINDS, type RuntimeComponentDto } from "../../shared/types.js";
import { StatusDot } from "../../shared/ui/status-dot.js";
import { EnabledSwitch } from "./enabled-switch.js";

export function ComponentBlock({ component }: { component: RuntimeComponentDto }) {
  const health = componentHealth(component);
  return <motion.div
    whileHover={{ y: -2 }}
    transition={{ duration: 0.15 }}
    className={cn("flex min-w-52 items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-xs transition-[border-color,box-shadow,opacity] hover:border-foreground/25 hover:shadow-sm", health === "off" && "opacity-60")}
  >
    <StatusDot health={health} />
    <button type="button" onClick={() => openComponent(component.instanceId)} className="min-w-0 flex-1 text-left">
      <span className="block truncate text-sm font-medium">{component.id}</span>
      <span className="block truncate text-xs text-muted-foreground">{blockCaption(component)}</span>
    </button>
    {TOGGLE_KINDS.includes(component.kind) ? <EnabledSwitch component={component} /> : null}
  </motion.div>;
}

function blockCaption(component: RuntimeComponentDto): string {
  if (component.runtimeError) return "Needs attention";
  return component.channel ?? component.version;
}
