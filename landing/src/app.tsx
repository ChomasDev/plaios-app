import { MotionConfig, motion, useInView, useScroll, useTransform, type MotionValue } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Blocks,
  BookOpen,
  Brain,
  Check,
  Clock,
  Copy,
  Cpu,
  Database,
  Eye,
  Github,
  Globe,
  HardDrive,
  House,
  KeyRound,
  MessageCircle,
  Network,
  Plug,
  Route,
  Search,
  Send,
  Sparkles,
  SquareTerminal,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { DESCRIPTIONS, EDGES, MESSAGE_PATH, NODES, type DiagramEdge } from "../../web/src/features/settings/architecture/architecture-model.js";
import { kindLabels } from "../../web/src/shared/health.js";
import { kindIcons } from "../../web/src/shared/kind-icons.js";
import type { InterfaceKind } from "../../web/src/shared/types.js";

const REPO = "https://github.com/ChomasDev/plaios";
const PACKAGES_REPO = "https://github.com/ChomasDev/plaios-packages";
const DOCS = `${REPO}/blob/main/docs/how-to-run.md`;
const CLONE = "git clone --recursive https://github.com/ChomasDev/plaios";
const START = "npx plaios";

/** The app's springs (web/src/shared/motion.ts), so the site moves like the product. */
const SPRING = { type: "spring", stiffness: 158, damping: 20, mass: 1 } as const;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return <motion.div
    className={className}
    initial={{ opacity: 0, y: 24 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.8, ease: EASE_OUT, delay }}
  >{children}</motion.div>;
}

function Mark() {
  return <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
    <rect x="3" y="3" width="11" height="11" rx="3.5" />
    <rect x="18" y="3" width="11" height="11" rx="5.5" className="mark-accent" />
    <rect x="3" y="18" width="11" height="11" rx="5.5" />
    <rect x="18" y="18" width="11" height="11" rx="3.5" />
  </svg>;
}

function CopyCommand({ command, label = command }: { command: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(timer);
  }, [copied]);
  return <button
    type="button"
    className="command"
    onClick={() => navigator.clipboard?.writeText(command).then(() => setCopied(true))}
    aria-label={`Copy command: ${command}`}
  >
    <span className="command-prompt" aria-hidden="true">$</span>
    <code>{label}</code>
    <span className="command-icon" aria-hidden="true">{copied ? <Check size={15} /> : <Copy size={15} />}</span>
    <span className="sr-only" aria-live="polite">{copied ? "Copied" : ""}</span>
  </button>;
}

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return <header className={scrolled ? "nav scrolled" : "nav"}>
    <div className="wrap nav-inner">
      <a href="/" className="brand" aria-label="PLAIOS home"><Mark /><span>PLAIOS</span></a>
      <nav aria-label="Main" className="nav-links">
        <a href="/#flow">How it works</a>
        <a href="/#plugins">Plugins</a>
        <a href="/#build">Build</a>
        <a href="/docs/">Docs</a>
      </nav>
      <a href={REPO} className="pill pill-dark nav-cta"><Github size={15} aria-hidden="true" />GitHub</a>
    </div>
  </header>;
}

/** Example plugins per kind; the landing has no runtime, so it shows a typical install instead. */
const SAMPLE: Record<InterfaceKind, string> = {
  input: "telegram +3",
  memory: "memory-graph",
  orchestrator: "orchestrator-default",
  agent: "agent-loop",
  output: "telegram +1",
  discovery: "discovery-memory",
  action: "ssh +5",
  system1: "jev",
  system2: "codex",
  database: "sqlite",
  env: "env-node · process + .env",
};

/** The guided tour follows one message; pointing at a node takes over. */
const TOUR: InterfaceKind[] = ["input", "memory", "orchestrator", "discovery", "agent", "action", "system2", "output"];

/** The control plane's architecture graph (settings page), drawn from the same model with a sample install. */
function Architecture() {
  const [tour, setTour] = useState(0);
  const [hovered, setHovered] = useState<InterfaceKind>();
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref);
  useEffect(() => {
    if (hovered || !visible) return;
    const timer = setInterval(() => setTour((index) => (index + 1) % TOUR.length), 2600);
    return () => clearInterval(timer);
  }, [hovered, visible]);
  const active = hovered ?? TOUR[tour]!;
  const linked = (edge: DiagramEdge) => edge.from === active || edge.to === active;
  const near = (kind: InterfaceKind) => kind === active || EDGES.some((edge) => linked(edge) && (edge.from === kind || edge.to === kind));
  const Icon = kindIcons[active];
  return <motion.figure
    ref={ref}
    className="arch"
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.55 }}
  >
    <div className="arch-scroll">
      <svg viewBox="0 50 960 480" className="arch-svg" onMouseLeave={() => setHovered(undefined)} aria-label="PLAIOS architecture: how a message flows between plugin kinds">
        <defs>
          <marker id="arch-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9Z" className="arrow" /></marker>
          <marker id="arch-arrow-on" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1L9 5L0 9Z" className="arrow on" /></marker>
        </defs>
        {EDGES.map((edge, index) => <g key={`${edge.from}-${edge.to}`} className={linked(edge) ? "edge on" : edge.quiet ? "edge quiet" : "edge"}>
          <motion.path
            d={edge.d}
            markerEnd={linked(edge) ? "url(#arch-arrow-on)" : "url(#arch-arrow)"}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.8 + index * 0.04 }}
          />
          {linked(edge) && <path d={edge.d} className="edge-dash" />}
          {linked(edge) && <text x={edge.lx} y={edge.ly} textAnchor="middle" className="edge-label">{edge.label}</text>}
        </g>)}
        <circle r="4" className="pulse"><animateMotion dur="3.6s" repeatCount="indefinite" path={MESSAGE_PATH} /></circle>
        <circle r="3" className="pulse soft"><animateMotion dur="3.6s" begin="1.8s" repeatCount="indefinite" path={MESSAGE_PATH} /></circle>
        {NODES.map((node, index) => {
          const NodeIcon = kindIcons[node.kind];
          const iconY = node.y + (node.h - 30) / 2;
          return <motion.g
            key={node.kind}
            role="button"
            tabIndex={0}
            aria-label={`${kindLabels[node.kind]}: ${DESCRIPTIONS[node.kind]}`}
            className={node.kind === active ? "arch-node on" : near(node.kind) ? "arch-node" : "arch-node dim"}
            onMouseEnter={() => setHovered(node.kind)}
            onFocus={() => setHovered(node.kind)}
            onBlur={() => setHovered(undefined)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: EASE_OUT, delay: 0.6 + index * 0.035 }}
          >
            <rect x={node.x} y={node.y} width={node.w} height={node.h} rx="16" className="node-box" />
            <rect x={node.x + 12} y={iconY} width="30" height="30" rx="9" className="node-tile" />
            <NodeIcon x={node.x + 19} y={iconY + 7} width={16} height={16} strokeWidth={2} className="node-icon" />
            <text x={node.x + 52} y={node.wide ? node.y + 22 : node.y + 28} className="node-title">{kindLabels[node.kind]}</text>
            <text x={node.x + 52} y={node.wide ? node.y + 38 : node.y + 46} className="node-sub">{SAMPLE[node.kind]}</text>
          </motion.g>;
        })}
      </svg>
    </div>
    <figcaption className="arch-caption">
      <motion.div key={active} className="arch-detail" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: EASE_OUT }}>
        <span className="arch-detail-icon"><Icon size={18} aria-hidden="true" /></span>
        <span><b>{kindLabels[active]}</b>{DESCRIPTIONS[active]}</span>
      </motion.div>
    </figcaption>
  </motion.figure>;
}

function Hero() {
  return <section id="top" className="hero">
    <div className="wrap hero-inner">
      <motion.a
        href="#manifesto"
        className="eyebrow"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_OUT }}
      ><Sparkles size={14} aria-hidden="true" />The Pluggable AI Operating System<ArrowRight size={14} aria-hidden="true" /></motion.a>
      <h1>
        {["AI stopped being an app.", "It's an operating system."].map((line, index) => <motion.span
          key={line}
          className={index === 1 ? "line soft" : "line"}
          initial={{ opacity: 0, y: 28, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.1 + index * 0.15 }}
        >{line}</motion.span>)}
      </h1>
      <motion.p
        className="lede"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.4 }}
      >
        PLAIOS is an open runtime where the model, the memory, the tools and every channel are plugins.
        Snap them together, swap them live, and run your agent on your own machine.
      </motion.p>
      <motion.div
        className="hero-actions"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.5 }}
      >
        <CopyCommand command={START} />
        <a href="#start" className="pill pill-primary">Get started<ArrowRight size={16} aria-hidden="true" /></a>
        <a href="#flow" className="pill pill-ghost">See how it thinks</a>
      </motion.div>
      <Architecture />
    </div>
  </section>;
}

const MANIFESTO = "For years, AI came sealed in someone else's box. One model, one chat window, their rules, their servers. PLAIOS breaks the box open. A tiny kernel, and everything else is a plugin you can read, replace or write yourself.";

function Word({ word, progress, range }: { word: string; progress: MotionValue<number>; range: [number, number] }) {
  const opacity = useTransform(progress, range, [0.14, 1]);
  return <motion.span style={{ opacity }}>{word} </motion.span>;
}

/** Words light up as the paragraph scrolls through the viewport. */
function Manifesto() {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.45"] });
  const words = MANIFESTO.split(" ");
  return <section id="manifesto" className="section manifesto">
    <div className="wrap narrow">
      <p className="kicker">Why it exists</p>
      <p ref={ref} className="manifesto-text">
        {words.map((word, index) => <Word key={index} word={word} progress={scrollYProgress} range={[index / words.length, (index + 1) / words.length]} />)}
      </p>
    </div>
  </section>;
}

interface Step { key: string; title: string; text: string; icon: LucideIcon; demo: ReactNode }

const STEPS: Step[] = [
  {
    key: "Input",
    title: "A message arrives",
    text: "From any channel plugin: the web chat, Telegram, live voice, a cron tick or the OpenAI-compatible API.",
    icon: MessageCircle,
    demo: <div className="bubble user"><span className="bubble-meta"><Send size={12} />Telegram</span>Turn off the lights when I leave for work.</div>,
  },
  {
    key: "Recall",
    title: "Memory remembers you",
    text: "Before anything else, the last turns and the memories most relevant to this message come back.",
    icon: Brain,
    demo: <div className="stack">
      <span className="memory">Leaves home around 8:10 on weekdays</span>
      <span className="memory">Hallway and kitchen lights are on Home Assistant</span>
      <span className="memory faint">Prefers short answers</span>
    </div>,
  },
  {
    key: "Decide",
    title: "The orchestrator picks the tools",
    text: "Discovery searches every installed capability. Only the ones that matter reach the model.",
    icon: Route,
    demo: <div className="stack">
      {[["home-assistant", true], ["cronjob", true], ["web.search", false], ["ssh", false]].map(([name, on]) => <span key={String(name)} className={on ? "tool on" : "tool"}>
        {on ? <Check size={13} /> : <span className="tool-dot" />}{name}
      </span>)}
    </div>,
  },
  {
    key: "Act",
    title: "The agent loop does the work",
    text: "The model reasons and calls tools, as many times as it takes, until the job is actually done.",
    icon: Workflow,
    demo: <pre className="log"><span className="dim">→</span> cronjob.schedule({"{"} at: <span className="str">"08:10 mon-fri"</span> {"}"}){"\n"}<span className="ok">✓</span> scheduled{"\n"}<span className="dim">→</span> home-assistant.turn_off({"{"} area: <span className="str">"home"</span> {"}"}){"\n"}<span className="ok">✓</span> linked to the schedule</pre>,
  },
  {
    key: "Deliver",
    title: "Every output answers",
    text: "One channel streams the answer live, the others get the finished text. Components can render rich UI.",
    icon: Send,
    demo: <div className="bubble agent"><span className="bubble-meta"><Sparkles size={12} />PLAIOS</span>Done. Every weekday at 8:10 the lights go off.</div>,
  },
  {
    key: "Learn",
    title: "It gets better",
    text: "The answer and anything new it learned are written back to memory, ready for the next message.",
    icon: Database,
    demo: <div className="stack">
      <motion.span className="memory new" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={SPRING}>+ Lights off automatically when leaving</motion.span>
      <span className="memory faint">Leaves home around 8:10 on weekdays</span>
    </div>,
  },
];

/** Six steps of AgentRuntime.process, auto-advancing until the reader picks one. */
function Flow() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { margin: "-20% 0px" });
  useEffect(() => {
    if (!auto || !visible) return;
    const timer = setInterval(() => setActive((index) => (index + 1) % STEPS.length), 3200);
    return () => clearInterval(timer);
  }, [auto, visible]);
  const step = STEPS[active]!;
  return <section id="flow" className="section">
    <div className="wrap">
      <Reveal className="head">
        <p className="kicker">How it works</p>
        <h2>One message, six moves.</h2>
        <p className="sub">Every message, from every channel, takes the same path through the kernel. Each stop is a plugin you can swap.</p>
      </Reveal>
      <Reveal delay={0.1}>
        <div ref={ref} className="flow">
          <div className="steps" role="tablist" aria-label="Message flow">
            {STEPS.map((item, index) => <button
              key={item.key}
              type="button"
              role="tab"
              id={`step-${index}`}
              aria-selected={index === active}
              aria-controls="step-panel"
              className={index === active ? "step active" : index < active ? "step done" : "step"}
              onClick={() => { setActive(index); setAuto(false); }}
            >
              <span className="step-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="step-key"><item.icon size={16} aria-hidden="true" />{item.key}</span>
              {index === active && <motion.span layoutId="step-bar" className="step-bar" transition={SPRING} />}
            </button>)}
          </div>
          <div id="step-panel" role="tabpanel" aria-labelledby={`step-${active}`} className="flow-panel">
            <motion.div key={active} className="flow-copy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE_OUT }}>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </motion.div>
            <motion.div key={`demo-${active}`} className="flow-demo" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING}>
              {step.demo}
            </motion.div>
          </div>
        </div>
      </Reveal>
    </div>
  </section>;
}

const PLUGINS: Array<{ group: string; items: Array<[string, LucideIcon]> }> = [
  { group: "Channels", items: [["Web chat", MessageCircle], ["Telegram", Send], ["Live voice", AudioLines], ["Scheduled prompts", Clock], ["OpenAI-compatible API", Plug]] },
  { group: "Intelligence", items: [["Codex", Cpu], ["Agent loop", Workflow], ["Orchestrator", Route], ["JEV orchestrator", Network]] },
  { group: "Memory", items: [["Memory graph", Brain], ["Discovery", Search], ["SQLite", HardDrive]] },
  { group: "Tools", items: [["Home Assistant", House], ["Web search", Globe], ["SSH", SquareTerminal], ["Shell", SquareTerminal], ["God's Eye View", Eye], ["Developer guide", BookOpen]] },
];

function Plugins() {
  return <section id="plugins" className="section tinted">
    <div className="wrap">
      <Reveal className="head">
        <p className="kicker">Everything is a plugin</p>
        <h2>Pick the pieces.<br /><span className="soft">Keep the ones you love.</span></h2>
        <p className="sub">Install from the built-in Store and the host loads it without a restart. Don't like one? Replace it with your own.</p>
      </Reveal>
      <div className="plugin-groups">
        {PLUGINS.map((group, groupIndex) => <Reveal key={group.group} delay={groupIndex * 0.06} className="plugin-group">
          <h3>{group.group}</h3>
          <ul>
            {group.items.map(([name, Icon]) => <li key={name}><span className="plugin-icon"><Icon size={16} aria-hidden="true" /></span>{name}</li>)}
          </ul>
        </Reveal>)}
      </div>
      <Reveal className="center"><a href={PACKAGES_REPO} className="link">Browse all packages<ArrowUpRight size={15} aria-hidden="true" /></a></Reveal>
    </div>
  </section>;
}

const TERMINAL: Array<[string, string]> = [
  ["cmd", "npx plaios"],
  ["out", "PLAIOS · the pluggable AI operating system"],
  ["q", "1/7  Which AI should power the agent?"],
  ["a", "     ◉ ✦ Codex with your ChatGPT account"],
  ["q", "4/7  How do you want to reach it?"],
  ["a", "     ▣ ✈ Telegram bot   ▣ ◷ Scheduled prompts"],
  ["q", "5/7  What should it be able to do?"],
  ["a", "     ▣ ⌕ Web search   ▣ ⌂ Home Assistant"],
  ["q", "6/7  Enter keys now for… (unpick to set up later)"],
  ["opt", "     ▣ Telegram bot   □ Home Assistant, later"],
  ["q", "7/7  Where should plugins be installed from?"],
  ["a", "     ◉ ☁ Public npm   ○ ⌂ Local registry"],
  ["q", "Start PLAIOS now?  Yes"],
  ["ok", "● PLAIOS is running  ➜  http://localhost:3100"],
]

function Onboard() {
  const ref = useRef<HTMLDivElement>(null);
  const visible = useInView(ref, { once: true, margin: "-15% 0px" });
  return <section id="start" className="section">
    <div className="wrap split">
      <Reveal className="split-copy">
        <p className="kicker">Get started</p>
        <h2>One command.<br /><span className="soft">Then just answer.</span></h2>
        <p className="sub">Run it in an empty folder. It asks which AI to use, where you want to talk to it and what it can do, lets you leave any key for later, writes the config, keeps the secrets in <code>.env</code> and starts. Needs Node.js 22.5 or newer.</p>
        <div className="steps-list">
          <CopyCommand command={START} />
        </div>
        <p className="sub">Or build it from source:</p>
        <div className="steps-list">
          <CopyCommand command={CLONE} label="git clone --recursive …/plaios" />
          <CopyCommand command="pnpm install && pnpm build && pnpm plaios" />
        </div>
      </Reveal>
      <div ref={ref} className="terminal" aria-label="Example of the PLAIOS setup wizard" role="img">
        <div className="terminal-bar"><i /><i /><i /><span>~/my-agent</span></div>
        <div className="terminal-body">
          {TERMINAL.map(([kind, text], index) => <motion.div
            key={index}
            className={`t-${kind}`}
            initial={{ opacity: 0, y: 4 }}
            animate={visible ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.3, ease: EASE_OUT, delay: index * 0.22 }}
          >{kind === "cmd" && <span className="t-prompt">$ </span>}{text}</motion.div>)}
        </div>
      </div>
    </div>
  </section>;
}

const CODE = `export class Weather implements Capability {
  readonly manifest = {
    id: "weather.forecast",
    description: "Gets the forecast for a city.",
    tags: ["weather", "rain", "meteo"],
  };

  // The host injects env, database, memory...
  constructor(private options: { env: Environment }) {}

  async execute({ city }: { city: string }) {
    const days = await forecast(city);
    return { success: true, data: { days } };
  }
}`;

const TOKEN = /(\/\/.*$)|("[^"]*")|\b(export|class|implements|readonly|constructor|private|async|await|const|return|true)\b|\b([A-Z][A-Za-z]+)\b/gm;

function highlight(source: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of source.matchAll(TOKEN)) {
    nodes.push(source.slice(last, match.index));
    const kind = match[1] ? "c-com" : match[2] ? "c-str" : match[3] ? "c-key" : "c-type";
    nodes.push(<span key={match.index} className={kind}>{match[0]}</span>);
    last = match.index + match[0].length;
  }
  nodes.push(source.slice(last));
  return nodes;
}

function Build() {
  return <section id="build" className="section tinted">
    <div className="wrap split reverse">
      <Reveal className="code-card">
        <div className="code-tabs"><span className="code-tab active">src/action.ts</span><span className="code-tab">agent-os.package.yaml</span></div>
        <pre className="code"><code>{highlight(CODE)}</code></pre>
      </Reveal>
      <Reveal className="split-copy" delay={0.1}>
        <p className="kicker">Build your own</p>
        <h2>A new skill is<br /><span className="soft">one small class.</span></h2>
        <p className="sub">Describe what it does, implement <code>execute</code>, publish. The agent finds it on its own, the Store installs it, and it can ship its own UI.</p>
        <ul className="checks">
          <li><Check size={16} aria-hidden="true" />Typed contracts from <code>@plaios/core</code></li>
          <li><Check size={16} aria-hidden="true" />Dependencies injected by the host</li>
          <li><Check size={16} aria-hidden="true" /><code>plaios create action weather</code> scaffolds it</li>
        </ul>
        <a href="/docs/" className="link">Read the developer guide<ArrowUpRight size={15} aria-hidden="true" /></a>
      </Reveal>
    </div>
  </section>;
}

const PRINCIPLES: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: HardDrive, title: "Local first", text: "Runs on your laptop, a mini PC or a server in your house. Your conversations stay in your SQLite file." },
  { icon: Blocks, title: "Hot-swappable", text: "Install, update or remove a plugin while the agent keeps running. A broken piece never takes down the rest." },
  { icon: KeyRound, title: "Secrets stay yours", text: "Keys live in .env, never in the config and never sent back through the API." },
  { icon: Network, title: "Interfaces, not vendors", text: "The model is a plugin like any other. Contracts are open, so nothing ties you to one provider." },
];

function Principles() {
  return <section className="section">
    <div className="wrap">
      <Reveal className="head">
        <p className="kicker">Principles</p>
        <h2>Built like an OS.<br /><span className="soft">Owned like a tool.</span></h2>
      </Reveal>
      <div className="principles">
        {PRINCIPLES.map((item, index) => <Reveal key={item.title} delay={index * 0.07} className="principle">
          <span className="principle-icon"><item.icon size={20} aria-hidden="true" /></span>
          <h3>{item.title}</h3>
          <p>{item.text}</p>
        </Reveal>)}
      </div>
    </div>
  </section>;
}

function Closing() {
  return <section className="section closing">
    <div className="wrap narrow center">
      <Reveal>
        <h2 className="closing-title">The next platform<br /><span className="soft">is yours to build.</span></h2>
        <p className="sub">One command to start it. Then make it think your way.</p>
        <div className="hero-actions">
          <CopyCommand command={START} />
          <a href={REPO} className="pill pill-dark"><Github size={16} aria-hidden="true" />Star on GitHub</a>
        </div>
      </Reveal>
    </div>
  </section>;
}

export function Footer() {
  return <footer className="footer">
    <div className="wrap footer-inner">
      <a href="/" className="brand"><Mark /><span>PLAIOS</span></a>
      <nav aria-label="Footer" className="footer-links">
        <a href={REPO}>Core</a>
        <a href={PACKAGES_REPO}>Packages</a>
        <a href={DOCS}>How to run</a>
        <a href="/docs/">Developer guide</a>
      </nav>
      <p>The Pluggable AI Operating System. Say it “PLAY-os”.</p>
    </div>
  </footer>;
}

export function App() {
  return <MotionConfig reducedMotion="user">
    <a href="#main" className="skip">Skip to content</a>
    <Nav />
    <main id="main">
      <Hero />
      <Manifesto />
      <Flow />
      <Plugins />
      <Onboard />
      <Build />
      <Principles />
      <Closing />
    </main>
    <Footer />
  </MotionConfig>;
}
