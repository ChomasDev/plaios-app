import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useRef } from "react";
import { flushSync } from "react-dom";

import { SNAPPY } from "../shared/motion.js";

/** The new theme is revealed by a circle growing from the button; the icon turns over as it swaps. */
export function ThemeToggle({ dark, onChange }: { dark: boolean; onChange(dark: boolean): void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const toggle = () => {
    const next = !dark;
    const apply = () => { document.documentElement.classList.toggle("dark", next); onChange(next); };
    const button = ref.current;
    if (typeof document.startViewTransition !== "function" || !button) return apply();
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return apply();
    const { left, top, width, height } = button.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const transition = document.startViewTransition(() => flushSync(apply));
    void transition.ready.then(() => document.documentElement.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 450, easing: "cubic-bezier(0.32, 0.72, 0, 1)", pseudoElement: "::view-transition-new(root)" },
    ));
  };
  return <button ref={ref} type="button" onClick={toggle} className="group grid size-8 place-items-center overflow-hidden rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Toggle theme">
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span key={dark ? "sun" : "moon"} initial={{ rotate: -90, scale: 0.5, opacity: 0 }} animate={{ rotate: 0, scale: 1, opacity: 1 }} exit={{ rotate: 90, scale: 0.5, opacity: 0 }} transition={SNAPPY}>
        {dark ? <Sun className="icon-gear size-4" /> : <Moon className="icon-wiggle size-4" />}
      </motion.span>
    </AnimatePresence>
  </button>;
}
