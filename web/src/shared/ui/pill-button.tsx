import { cn } from "@plaios/microfrontend";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

/** Rounded text button; without `onClick` it submits its form. */
export function PillButton({ children, quiet, onClick, disabled }: { children: ReactNode; quiet?: boolean; onClick?(): void; disabled?: boolean }) {
  return <motion.button
    type={onClick ? "button" : "submit"}
    onClick={onClick}
    disabled={disabled}
    whileTap={disabled ? undefined : { scale: 0.96 }}
    className={cn(
      "shrink-0 rounded-full px-4 py-1.5 text-sm transition-[opacity,background-color,color] disabled:opacity-40",
      quiet ? "text-muted-foreground hover:bg-muted hover:text-foreground" : "bg-foreground text-background hover:opacity-85",
    )}
  >{children}</motion.button>;
}
