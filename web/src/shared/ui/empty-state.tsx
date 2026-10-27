import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { rise } from "../motion.js";

/** An illustration, one line saying what happened and an optional way forward. */
export function EmptyState({ art, title, hint, children }: { art: ReactNode; title: string; hint?: ReactNode; children?: ReactNode }) {
  return <div className="flex flex-col items-center py-10 text-center">
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="w-full max-w-[18rem]">{art}</motion.div>
    <motion.p {...rise(0.08)} className="mt-6 font-medium">{title}</motion.p>
    {hint ? <motion.p {...rise(0.12)} className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</motion.p> : null}
    {children ? <motion.div {...rise(0.16)} className="mt-4">{children}</motion.div> : null}
  </div>;
}
