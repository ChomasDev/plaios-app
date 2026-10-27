/** Apple's spring(response 0.5, dampingFraction 0.8): stiffness (2π/r)², damping 4πζ/r. For things that travel. */
export const SPRING = { type: "spring", stiffness: 158, damping: 20, mass: 1 } as const;
/** Near critically damped and quick: pills, knobs and icons that should snap without wobbling. */
export const SNAPPY = { type: "spring", stiffness: 520, damping: 42, mass: 1 } as const;
/** iOS sheet curve: fast start, long settle. */
export const SHEET_EASE = [0.32, 0.72, 0, 1] as const;
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Fade-and-rise for anything that appears; `delay` staggers siblings. */
export function rise(delay = 0) {
  return { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: EASE_OUT, delay } } as const;
}

/** Delay for the nth item of a list, capped so long lists never trickle in. */
export function stagger(index: number): number {
  return Math.min(index, 8) * 0.03;
}
