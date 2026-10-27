import { cn } from "@plaios/microfrontend";
import { motion } from "framer-motion";

import type { Health } from "../health.js";

const COLORS: Record<Health, string> = { online: "bg-emerald-500", error: "bg-destructive", off: "bg-muted-foreground/40" };

/** Health at a glance; only a fault pulses, so the eye goes where it is needed. */
export function StatusDot({ health }: { health: Health }) {
  return <span aria-hidden="true" className="relative inline-flex size-2 shrink-0">
    {health === "error" ? <motion.span
      className={cn("absolute inset-0 rounded-full", COLORS.error)}
      animate={{ scale: [1, 2.4], opacity: [0.5, 0] }}
      transition={{ duration: 1.6, repeat: Number.POSITIVE_INFINITY, ease: "easeOut" }}
    /> : null}
    <span className={cn("relative size-2 rounded-full transition-colors duration-300", COLORS[health])} />
  </span>;
}
