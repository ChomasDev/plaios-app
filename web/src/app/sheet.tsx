import { cn } from "@agent-os/microfrontend";
import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { SHEET_EASE } from "../shared/motion.js";

const SLIDE = { duration: 0.42, ease: SHEET_EASE };

/** An edgeless panel that eases in from its edge over the chat; swipe, Escape or the backdrop send it back. */
export function Sheet({ side, label, children }: { side: "left" | "right"; label: string; children: ReactNode }) {
  const offset = side === "left" ? "-100%" : "100%";
  return <motion.aside
    aria-label={label}
    initial={{ x: offset }}
    animate={{ x: 0 }}
    exit={{ x: offset }}
    transition={SLIDE}
    className={cn(
      // No edge: the background fades from solid at the screen edge to transparent over the blurred chat.
      "absolute inset-y-0 z-30 w-full overflow-y-auto overscroll-contain from-background from-55% to-transparent",
      side === "left" ? "left-0 max-w-md bg-linear-to-r" : "right-0 bg-linear-to-l lg:w-[min(72rem,94vw)]",
    )}
  >{children}</motion.aside>;
}

export function Backdrop({ onClose }: { onClose(): void }) {
  return <motion.button
    type="button"
    aria-label="Back to chat"
    onClick={onClose}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    transition={{ duration: 0.3 }}
    className="absolute inset-0 z-20 cursor-default bg-background/70 backdrop-blur-md"
  />;
}
