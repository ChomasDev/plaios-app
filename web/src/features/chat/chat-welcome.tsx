import { motion } from "framer-motion";

import { rise } from "../../shared/motion.js";
import { ChatScene } from "../../shared/ui/illustrations.js";

export function ChatWelcome() {
  return <div className="flex flex-1 flex-col justify-center pb-16">
    <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="mb-6 -ml-2 w-56"><ChatScene /></motion.div>
    <motion.h1 {...rise()} className="text-3xl font-medium tracking-tight">What do you need?</motion.h1>
    <motion.p {...rise(0.06)} className="mt-3 text-muted-foreground">The parts of PLAIOS the agent uses to answer show up right here.</motion.p>
  </div>;
}
