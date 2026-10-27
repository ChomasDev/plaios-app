import { motion, type Transition } from "framer-motion";
import type { ReactNode } from "react";

/*
 * Flat, unDraw-style scenes drawn for Agent OS: one accent (the theme's primary) over neutral tokens,
 * so every scene follows light and dark mode. Each has one slow idle motion and nothing that blinks.
 */

const FLOAT: Transition = { duration: 4, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" };
const PIVOT = { transformBox: "fill-box", transformOrigin: "center" } as const;

function Scene({ label, children }: { label: string; children: ReactNode }) {
  return <svg viewBox="0 0 320 220" role="img" aria-label={label} className="h-auto w-full max-w-[18rem]">
    <ellipse cx="160" cy="204" rx="128" ry="7" className="fill-muted" />
    {children}
  </svg>;
}

function Sparkle({ x, y, size = 6, delay = 0 }: { x: number; y: number; size?: number; delay?: number }) {
  return <motion.path
    d={`M${x} ${y - size}L${x + size * 0.3} ${y - size * 0.3}L${x + size} ${y}L${x + size * 0.3} ${y + size * 0.3}L${x} ${y + size}L${x - size * 0.3} ${y + size * 0.3}L${x - size} ${y}L${x - size * 0.3} ${y - size * 0.3}Z`}
    className="fill-primary"
    style={PIVOT}
    animate={{ scale: [0.6, 1, 0.6], rotate: [0, 45, 0], opacity: [0.5, 1, 0.5] }}
    transition={{ ...FLOAT, duration: 3, delay }}
  />;
}

function Plant({ x }: { x: number }) {
  return <g>
    <motion.g style={{ transformBox: "fill-box", transformOrigin: "50% 100%" }} animate={{ rotate: [-3, 3, -3] }} transition={{ ...FLOAT, duration: 5 }}>
      <path d={`M${x} 176C${x - 2} 150 ${x - 20} 138 ${x - 26} 120C${x - 8} 126 ${x + 2} 148 ${x} 176Z`} className="fill-primary" />
      <path d={`M${x} 176C${x + 2} 146 ${x + 18} 132 ${x + 24} 112C${x + 6} 120 ${x - 4} 146 ${x} 176Z`} className="fill-primary/70" />
      <path d={`M${x} 176C${x - 1} 156 ${x + 8} 146 ${x + 6} 132C${x - 6} 142 ${x - 4} 160 ${x} 176Z`} className="fill-primary/45" />
    </motion.g>
    <path d={`M${x - 16} 174H${x + 16}L${x + 12} 204H${x - 12}Z`} className="fill-foreground/80" />
  </g>;
}

/** Chat welcome: a window filling up with a conversation, the last bubble still typing. */
export function ChatScene() {
  return <Scene label="A conversation starting">
    <circle cx="200" cy="96" r="72" className="fill-primary/10" />
    <Plant x={52} />
    <motion.g animate={{ y: [0, -5, 0] }} transition={FLOAT}>
      <rect x="92" y="34" width="156" height="156" rx="16" className="fill-background stroke-foreground/15" strokeWidth="2" />
      <circle cx="110" cy="52" r="4" className="fill-foreground/15" />
      <circle cx="122" cy="52" r="4" className="fill-foreground/15" />
      <circle cx="134" cy="52" r="4" className="fill-foreground/15" />
      <rect x="106" y="72" width="86" height="22" rx="11" className="fill-muted" />
      <rect x="148" y="104" width="86" height="22" rx="11" className="fill-primary" />
      <rect x="160" y="113" width="40" height="4" rx="2" className="fill-primary-foreground/70" />
      <rect x="106" y="136" width="58" height="24" rx="12" className="fill-muted" />
      {[122, 135, 148].map((cx, index) => <motion.circle
        key={cx} cx={cx} cy="148" r="3.5" className="fill-foreground/40"
        animate={{ y: [0, -3, 0], opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, delay: index * 0.18 }}
      />)}
    </motion.g>
    <Sparkle x={262} y={42} />
    <Sparkle x={80} y={70} size={4} delay={1.2} />
    <Sparkle x={272} y={150} size={5} delay={0.6} />
  </Scene>;
}

/** No conversations yet: an empty tray, a clock that keeps ticking and one sheet waiting to land. */
export function EmptyHistoryScene() {
  return <Scene label="No conversations yet">
    <circle cx="160" cy="110" r="74" className="fill-primary/10" />
    <path d="M86 150L108 118H212L234 150V188A10 10 0 0 1 224 198H96A10 10 0 0 1 86 188Z" className="fill-muted" />
    <path d="M86 150H130C130 162 142 170 160 170C178 170 190 162 190 150H234V188A10 10 0 0 1 224 198H96A10 10 0 0 1 86 188Z" className="fill-foreground/10" />
    <motion.g animate={{ y: [0, -8, 0], rotate: [-6, -2, -6] }} transition={FLOAT} style={PIVOT}>
      <rect x="128" y="64" width="64" height="80" rx="8" className="fill-background stroke-foreground/15" strokeWidth="2" />
      <rect x="140" y="80" width="40" height="5" rx="2.5" className="fill-primary" />
      <rect x="140" y="94" width="30" height="5" rx="2.5" className="fill-muted" />
      <rect x="140" y="108" width="36" height="5" rx="2.5" className="fill-muted" />
    </motion.g>
    <g>
      <circle cx="232" cy="66" r="22" className="fill-primary" />
      <circle cx="232" cy="66" r="17" className="fill-background" />
      {/* SVG's own rotate keeps the pivot on the clock's centre, which CSS transform-origin does not reliably do. */}
      <rect x="231" y="53" width="2" height="13" rx="1" className="fill-foreground/80">
        <animateTransform attributeName="transform" type="rotate" from="0 232 66" to="360 232 66" dur="8s" repeatCount="indefinite" />
      </rect>
      <rect x="231" y="60" width="2" height="7" rx="1" transform="rotate(-60 232 66)" className="fill-foreground/80" />
    </g>
    <Sparkle x={74} y={84} size={5} />
    <Sparkle x={254} y={124} size={4} delay={1} />
  </Scene>;
}

/** Nothing matched: a magnifier sweeping over empty cards. */
export function NoResultsScene() {
  return <Scene label="No matching results">
    <circle cx="160" cy="104" r="76" className="fill-primary/10" />
    {[[70, 96], [130, 76], [190, 96]].map(([x, y]) => <rect key={x} x={x} y={y} width="56" height="70" rx="10" className="fill-background stroke-foreground/15" strokeWidth="2" strokeDasharray="6 6" />)}
    <motion.g animate={{ x: [-26, 26, -26], rotate: [-6, 6, -6] }} transition={{ ...FLOAT, duration: 6 }} style={PIVOT}>
      <circle cx="160" cy="112" r="30" className="fill-background/70 stroke-foreground/80" strokeWidth="8" />
      <rect x="180" y="134" width="12" height="40" rx="6" transform="rotate(-45 186 154)" className="fill-foreground/80" />
      <text x="160" y="124" textAnchor="middle" className="fill-primary text-[34px] font-semibold">?</text>
    </motion.g>
    <Sparkle x={258} y={58} />
    <Sparkle x={62} y={60} size={4} delay={0.8} />
  </Scene>;
}

/** No README: a blank page and a pencil hovering, about to write. */
export function BlankDocScene() {
  return <Scene label="No README yet">
    <circle cx="160" cy="104" r="76" className="fill-primary/10" />
    <path d="M112 34H186L214 62V188A8 8 0 0 1 206 196H112A8 8 0 0 1 104 188V42A8 8 0 0 1 112 34Z" className="fill-background stroke-foreground/15" strokeWidth="2" />
    <path d="M186 34V56A6 6 0 0 0 192 62H214Z" className="fill-muted" />
    <rect x="122" y="80" width="56" height="6" rx="3" className="fill-primary" />
    {[100, 116, 132, 148].map((y, index) => <rect key={y} x="122" y={y} width={[74, 62, 70, 40][index]} height="5" rx="2.5" className="fill-muted" />)}
    <motion.g animate={{ x: [0, -10, 0], y: [0, 6, 0], rotate: [0, -4, 0] }} transition={{ ...FLOAT, duration: 3.5 }} style={PIVOT}>
      <g transform="rotate(40 236 120)">
        <rect x="228" y="70" width="16" height="78" rx="3" className="fill-primary" />
        <rect x="228" y="70" width="16" height="12" rx="3" className="fill-foreground/80" />
        <path d="M228 148H244L236 166Z" className="fill-foreground/20" />
        <path d="M233 159H239L236 166Z" className="fill-foreground/80" />
      </g>
    </motion.g>
    <Sparkle x={72} y={70} size={5} />
  </Scene>;
}

/** Something is unreachable: a plug that keeps reaching for its socket. */
export function UnpluggedScene() {
  return <Scene label="Connection unavailable">
    <circle cx="160" cy="104" r="76" className="fill-primary/10" />
    <path d="M20 120H96" className="stroke-foreground/80" strokeWidth="6" strokeLinecap="round" fill="none" />
    <rect x="96" y="96" width="44" height="48" rx="10" className="fill-foreground/80" />
    <rect x="104" y="110" width="8" height="6" rx="2" className="fill-background" />
    <rect x="104" y="124" width="8" height="6" rx="2" className="fill-background" />
    <motion.g animate={{ x: [0, -14, 0] }} transition={{ ...FLOAT, duration: 2.6 }}>
      <rect x="190" y="98" width="20" height="5" rx="2" className="fill-foreground/60" />
      <rect x="190" y="137" width="20" height="5" rx="2" className="fill-foreground/60" />
      <rect x="208" y="90" width="48" height="60" rx="12" className="fill-primary" />
      <path d="M256 120H300" className="stroke-primary" strokeWidth="6" strokeLinecap="round" fill="none" />
    </motion.g>
    {[[160, 96, 0], [168, 120, 0.3], [158, 144, 0.6]].map(([x, y, delay]) => <motion.path
      key={y} d={`M${x} ${y}l8 -6`} className="stroke-primary" strokeWidth="3" strokeLinecap="round"
      animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.3, repeat: Number.POSITIVE_INFINITY, delay }}
    />)}
  </Scene>;
}
