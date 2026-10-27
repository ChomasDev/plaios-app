import { useEffect, useRef, type RefObject } from "react";

import type { Pane } from "./routes.js";

const PANES: readonly Pane[] = ["history", "chat", "manage"];
const SWIPE_THRESHOLD = 90;
const SWIPE_GAP_MS = 150;
const SWIPE_COOLDOWN_MS = 700;

/**
 * Trackpad: a horizontal swipe past the threshold moves one pane; Escape returns to chat.
 * The wheel listener is not passive so the browser's own back/forward swipe never fires.
 */
export function usePaneGestures(target: RefObject<HTMLElement | null>, pane: Pane, goTo: (pane: Pane) => void) {
  const latest = useRef({ pane, goTo });
  latest.current = { pane, goTo };

  useEffect(() => {
    const element = target.current;
    if (!element) return;
    const swipe = { total: 0, last: 0, until: 0 };
    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
      if (scrollsHorizontally(event.target)) return;
      event.preventDefault();
      const now = Date.now();
      if (now < swipe.until) return;
      if (now - swipe.last > SWIPE_GAP_MS) swipe.total = 0;
      swipe.last = now;
      swipe.total += event.deltaX;
      if (Math.abs(swipe.total) < SWIPE_THRESHOLD) return;
      const next = PANES[PANES.indexOf(latest.current.pane) + Math.sign(swipe.total)];
      Object.assign(swipe, { total: 0, until: now + SWIPE_COOLDOWN_MS });
      if (next) latest.current.goTo(next);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || latest.current.pane === "chat") return;
      latest.current.goTo("chat");
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      element.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
    };
  }, [target]);
}

/** Code blocks and wide tables scroll sideways themselves; leave their swipes alone. */
function scrollsHorizontally(target: EventTarget | null): boolean {
  for (let node = target instanceof Element ? target : null; node; node = node.parentElement) {
    if (node.scrollWidth > node.clientWidth && getComputedStyle(node).overflowX !== "hidden" && getComputedStyle(node).overflowX !== "visible") return true;
  }
  return false;
}
