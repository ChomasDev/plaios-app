import { motion } from "framer-motion";
import { ChevronUp } from "lucide-react";

import { rise } from "../../../shared/motion.js";

/** Touch screens have no wheel to pull with; they get a quiet button instead. */
export function ShowEarlierButton({ onClick }: { onClick(): void }) {
  return <motion.button
    {...rise()}
    type="button"
    onClick={onClick}
    whileTap={{ scale: 0.96 }}
    className="group mx-auto mt-4 hidden items-center gap-1 rounded-full px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground pointer-coarse:flex"
  >
    <ChevronUp className="icon-nudge-up size-3.5" />Earlier conversation
  </motion.button>;
}
