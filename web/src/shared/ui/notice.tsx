import { cn } from "@agent-os/microfrontend";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { rise } from "../motion.js";

export function Notice({ tone, children }: { tone?: "error"; children: ReactNode }) {
  return <motion.div
    {...rise()}
    role={tone === "error" ? "alert" : "status"}
    className={cn("mb-6 flex items-center gap-3 rounded-xl px-4 py-3 text-sm", tone === "error" ? "bg-destructive/10 text-destructive" : "bg-muted")}
  >{children}</motion.div>;
}
