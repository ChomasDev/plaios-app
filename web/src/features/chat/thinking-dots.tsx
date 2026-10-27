import { motion } from "framer-motion";

const DOTS = [0, 0.15, 0.3];

export function ThinkingDots() {
  return <span role="status" aria-label="Thinking" className="inline-flex h-7 items-center gap-1">
    {DOTS.map((delay) => <motion.i
      key={delay}
      className="inline-block size-1.5 rounded-full bg-muted-foreground"
      animate={{ opacity: [0.25, 0.9, 0.25], y: [0, -2, 0] }}
      transition={{ duration: 1.1, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay }}
    />)}
  </span>;
}
