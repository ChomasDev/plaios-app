import { cn } from "@agent-os/microfrontend";
import { motion } from "framer-motion";

import { SNAPPY } from "../motion.js";

export function Switch({ checked, label, disabled, onChange }: { checked: boolean; label: string; disabled?: boolean; onChange(checked: boolean): void }) {
  return <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn("flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 disabled:opacity-50", checked ? "justify-end bg-emerald-500" : "justify-start bg-muted-foreground/30")}
  >
    <motion.span layout transition={SNAPPY} className="size-4 rounded-full bg-white shadow-sm" />
  </button>;
}
