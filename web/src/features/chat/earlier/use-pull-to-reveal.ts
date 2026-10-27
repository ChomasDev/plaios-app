import { animate, useMotionValue, useTransform } from "framer-motion";
import { useCallback, useRef, type RefObject, type WheelEvent } from "react";

import { SPRING } from "../../../shared/motion.js";

const FRICTION = 0.5;
const SNAP = 120;
const MAX = 420;
const RELEASE_MS = 180;

/** Pulling past the top drags the next older conversation in with friction; past the snap point `onSnap` reveals it. */
export function usePullToReveal(scrollRef: RefObject<HTMLElement | null>, enabled: boolean, { onPull, onSnap }: { onPull(): void; onSnap(): void }) {
  const pull = useMotionValue(0);
  const peekHeight = useTransform(pull, (value) => value * FRICTION);
  const peekOpacity = useTransform(pull, [0, SNAP / FRICTION], [0, 0.7]);
  const release = useRef<ReturnType<typeof setTimeout>>(undefined);

  const onWheel = (event: WheelEvent) => {
    const element = scrollRef.current;
    if (!enabled || !element || element.scrollTop > 0) return;
    if (event.deltaY >= 0 && pull.get() === 0) return;
    clearTimeout(release.current);
    pull.stop();
    onPull();
    const value = Math.max(0, Math.min(MAX, pull.get() - event.deltaY));
    if (value * FRICTION >= SNAP) {
      pull.set(0);
      onSnap();
      return;
    }
    pull.set(value);
    release.current = setTimeout(() => animate(pull, 0, SPRING), RELEASE_MS);
  };
  const reset = useCallback(() => pull.set(0), [pull]);

  return { onWheel, peekHeight, peekOpacity, reset };
}
