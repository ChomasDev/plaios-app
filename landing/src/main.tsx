import { StrictMode, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Code2,
  Copy,
  Database,
  Github,
  Layers3,
  Menu,
  Network,
  Pause,
  Play,
  Send,
  Terminal,
  X,
} from "lucide-react";
import "./styles.css";

const REPO = "https://github.com/ChomasDev/AgentOs-core";
const PACKAGES_REPO = "https://github.com/ChomasDev/AgentOs-packages";
const DOCS = "https://github.com/ChomasDev/appdynamic/blob/main/README.md";

function Mark({ small = false }: { small?: boolean }) {
  return (
    <svg
      className={small ? "brand-mark small" : "brand-mark"}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden="true"
    >
      <path d="m20 4 14 8v16l-14 8-14-8V12L20 4Z" />
      <path d="m6 12 14 8 14-8M20 20v16M13 8l14 8v8l-7 4-7-4v-8l14-8" />
    </svg>
  );
}

function MatrixCore() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const rotationRef = useRef({ yaw: 0, pitch: -0.28 });
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    let width = 0,
      height = 0,
      frame = 0,
      last = 0,
      time = timeRef.current;
    let visible = true;
    const rotation = rotationRef.current;
    let drag: { id: number; x: number; y: number } | null = null;
    const symbols = "01.:+*░▒≡<>/{}";
    // Characters and surface markings stay attached to the rotating object.
    // Changing glyphs or shading bands each frame makes rotation look like noise.
    type CharacterPoint = {
      x: number;
      y: number;
      z: number;
      char: string;
      light: number;
    };
    const surface: CharacterPoint[] = [];
    for (let latitude = 1; latitude < 48; latitude++) {
      const phi = (Math.PI * latitude) / 48;
      const ring = Math.sin(phi);
      const count = Math.max(6, Math.floor(100 * ring));
      for (let longitude = 0; longitude < count; longitude++) {
        const theta = (Math.PI * 2 * longitude) / count;
        const band = (Math.sin(phi * 9 + theta * 3) + 1) / 2;
        surface.push({
          x: ring * Math.cos(theta),
          y: Math.cos(phi),
          z: ring * Math.sin(theta),
          char: symbols[(latitude * 7 + longitude) % symbols.length]!,
          light: 0.35 + 0.65 * band ** 3,
        });
      }
    }
    const draw = () => {
      context.clearRect(0, 0, width, height);
      const radius = Math.min(width * 0.36, height * 0.37);
      const cx = width * 0.5,
        cy = height * 0.49;
      context.font = '10px "IBM Plex Mono", monospace';
      context.textAlign = "center";
      // A sparse character field continues beyond the sphere into its orbit.
      for (let y = 14; y < height; y += 17) {
        for (let x = 8; x < width; x += 12) {
          const distance = Math.hypot((x - cx) / radius, (y - cy) / radius);
          const noise = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
          if (noise - Math.floor(noise) > 0.91 && distance > 1.1) {
            context.fillStyle = "rgba(111,153,213,0.12)";
            context.fillText((x + y) % 3 ? "." : "+", x, y);
          }
        }
      }
      const points: CharacterPoint[] = [];
      const sinRotation = Math.sin(rotation.yaw);
      const cosRotation = Math.cos(rotation.yaw);
      const tilt = rotation.pitch;
      const sinTilt = Math.sin(tilt);
      const cosTilt = Math.cos(tilt);
      for (const point of surface) {
        const x = point.x * cosRotation + point.z * sinRotation;
        const z = -point.x * sinRotation + point.z * cosRotation;
        const y = point.y * cosTilt - z * sinTilt;
        const depth = point.y * sinTilt + z * cosTilt;
        const scale = 2.8 / (2.8 - depth * 0.32);
        points.push({
          x: cx + x * radius * scale,
          y: cy + y * radius * scale,
          z: depth,
          char: point.char,
          light: point.light,
        });
      }
      points.sort((a, b) => a.z - b.z);
      context.fillStyle = "rgb(160,192,250)";
      for (const point of points) {
        // Fade continuously around the silhouette instead of popping at z = 0.
        const front = Math.max(0, Math.min(1, (point.z + 0.2) / 1.2));
        const visibility = front * front * (3 - 2 * front);
        context.globalAlpha = 0.025 + visibility * (0.3 + point.light * 0.6);
        context.fillText(point.char, point.x, point.y);
      }
      context.globalAlpha = 1;
      // An inclined orbital ring makes the modular core read as a spatial object.
      for (let i = 0; i < 240; i++) {
        const angle = (i / 240) * Math.PI * 2 + time * 0.035;
        const x = Math.cos(angle) * radius * 1.42;
        const y = Math.sin(angle) * radius * 0.33;
        const tilt = -0.43;
        context.fillStyle = `rgba(142,179,239,${0.3 + Math.sin(angle) * 0.15})`;
        context.fillText(
          i % 8 === 0 ? "+" : "·",
          cx + x * Math.cos(tilt) - y * Math.sin(tilt),
          cy + x * Math.sin(tilt) + y * Math.cos(tilt),
        );
      }
    };
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
    });
    intersection.observe(canvas);
    const startDrag = (event: PointerEvent) => {
      if (!event.isPrimary || event.button !== 0 || drag) return;
      event.preventDefault();
      canvas.focus({ preventScroll: true });
      canvas.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.classList.add("is-dragging");
    };
    const move = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const sensitivity = (Math.PI * 2) / Math.max(width, 1);
      rotation.yaw += (event.clientX - drag.x) * sensitivity;
      rotation.pitch = Math.max(
        -1.2,
        Math.min(1.2, rotation.pitch - (event.clientY - drag.y) * sensitivity),
      );
      drag.x = event.clientX;
      drag.y = event.clientY;
      // Manual rotation also works when automatic motion is disabled.
      if (paused || reduced) draw();
    };
    const endDrag = () => {
      const pointerId = drag?.id;
      drag = null;
      canvas.classList.remove("is-dragging");
      if (pointerId !== undefined && canvas.hasPointerCapture(pointerId)) {
        canvas.releasePointerCapture(pointerId);
      }
    };
    const finishPointer = (event: PointerEvent) => {
      if (event.pointerId === drag?.id) endDrag();
    };
    const rotateWithKeyboard = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      event.preventDefault();
      if (event.key === "ArrowLeft") rotation.yaw -= 0.15;
      if (event.key === "ArrowRight") rotation.yaw += 0.15;
      if (event.key === "ArrowUp")
        rotation.pitch = Math.min(1.2, rotation.pitch + 0.15);
      if (event.key === "ArrowDown")
        rotation.pitch = Math.max(-1.2, rotation.pitch - 0.15);
      draw();
    };
    canvas.addEventListener("pointerdown", startDrag);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", finishPointer);
    canvas.addEventListener("pointercancel", finishPointer);
    canvas.addEventListener("lostpointercapture", finishPointer);
    canvas.addEventListener("keydown", rotateWithKeyboard);
    canvas.addEventListener("blur", endDrag);
    window.addEventListener("blur", endDrag);
    document.addEventListener("visibilitychange", endDrag);
    const animate = (now: number) => {
      // Use elapsed time at the display refresh rate. Capping the delta avoids
      // jumps when a background tab or an offscreen canvas becomes visible again.
      const delta = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      if (visible && !document.hidden && !drag) {
        time += delta;
        timeRef.current = time;
        rotation.yaw += delta * 0.28;
      }
      if (visible && !document.hidden) draw();
      frame = requestAnimationFrame(animate);
    };
    resize();
    if (!paused && !reduced) frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      intersection.disconnect();
      endDrag();
      canvas.removeEventListener("pointerdown", startDrag);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", finishPointer);
      canvas.removeEventListener("pointercancel", finishPointer);
      canvas.removeEventListener("lostpointercapture", finishPointer);
      canvas.removeEventListener("keydown", rotateWithKeyboard);
      canvas.removeEventListener("blur", endDrag);
      window.removeEventListener("blur", endDrag);
      document.removeEventListener("visibilitychange", endDrag);
    };
  }, [paused, reduced]);
  return (
    <div className="core-art">
      <canvas
        ref={canvasRef}
        tabIndex={0}
        role="img"
        aria-label="Interactive ASCII globe. Drag or use the arrow keys to rotate."
      />
      <div className="core-coordinate">agent.core / ∞</div>
      <div className="core-caption">
        <span>
          <span className="status-dot" /> Drag to explore
        </span>
        <button
          className="motion-button"
          onClick={() => setPaused(!paused)}
          disabled={reduced}
          aria-label={
            reduced
              ? "Animation disabled by reduced motion preference"
              : paused
                ? "Play animation"
                : "Pause animation"
          }
        >
          {paused || reduced ? <Play size={13} /> : <Pause size={13} />}
        </button>
      </div>
    </div>
  );
}

const capabilities = [
  {
    name: "Memory",
    icon: Database,
    title: "Context that stays connected.",
    description:
      "Give your agents a memory beyond the current conversation. Store entities and relationships in a local graph, then recall what matters.",
    package: "memory-graph",
    file: "memory.yaml",
    lines: [
      'package: "@agent-os/memory-graph"',
      "interface: memory-graph.memory",
      "instanceId: memory:main",
      "config:",
      "  traversalDepth: 2",
    ],
    nodes: ["SQLite", "Graph memory", "Your agent"],
    note: "A local graph. A longer memory.",
  },
  {
    name: "Actions",
    icon: Terminal,
    title: "Let your agents do the work.",
    description:
      "Connect local commands, remote machines, search, and home automation. Expose the capabilities your agent needs through typed interfaces.",
    package: "action-cli",
    file: "action.yaml",
    lines: [
      'package: "@agent-os/action-cli"',
      "interface: action-cli.action",
      "instanceId: action:cli",
      "config:",
      '  allowedCommands: "pwd,ls,stat"',
    ],
    nodes: ["Your agent", "Discovery", "CLI / SSH"],
    note: "Useful tools, discoverable at runtime.",
  },
  {
    name: "Channels",
    icon: Send,
    title: "One runtime. Your interfaces.",
    description:
      "Talk to your agents through Telegram or connect an application through an OpenAI-compatible HTTP API, including streaming responses.",
    package: "openrouter-api",
    file: "channels.ts",
    lines: [
      "new OpenRouterApiInput({",
      '  hostname: "127.0.0.1",',
      "  port: 3000,",
      '  models: ["agent-os"],',
      "});",
    ],
    nodes: ["Telegram / API", "Your agent", "Response"],
    note: "Bring the conversation to your agent.",
  },
  {
    name: "Orchestration",
    icon: Network,
    title: "Your logic runs the show.",
    description:
      "Choose how your agents plan and act. Orchestrators and agent loops are independent packages, so you can change the strategy as your system grows.",
    package: "orchestrator-default",
    file: "architecture",
    lines: [
      "input → orchestrator",
      "        ↓",
      "      agent loop",
      "        ↓",
      "memory + discovered actions",
    ],
    nodes: ["Input", "Orchestrator", "Agent loop"],
    note: "Independent pieces. One composed system.",
  },
];
const installModes = [
  {
    name: "From source",
    title: "Make yourself at home.",
    lines: [
      "git clone https://github.com/ChomasDev/ModularAgentOs.git",
      "cd ModularAgentOs",
      "pnpm install",
      "pnpm build",
    ],
    note: "Requires Node.js 22.5+ and pnpm 10.28+. Follow the runtime setup guide to configure your package registry and start your agents.",
  },
  {
    name: "Start the runtime",
    title: "Bring your system online.",
    lines: ["pnpm agentos start"],
    note: "Run from your installed workspace. Configure the npm-compatible registry in agent-os.yaml and make sure your capability packages are available there.",
  },
  {
    name: "Build a plugin",
    title: "Give it a new capability.",
    lines: ["pnpm agentos create input,output my-plugin --yes"],
    note: "Run from your installed workspace. Generates typed input and output interfaces, a package manifest, and React management screens.",
  },
];

function App() {
  const [menu, setMenu] = useState(false);
  const [activeCapability, setActiveCapability] = useState(0);
  const [installMode, setInstallMode] = useState(0);
  const [copyStatus, setCopyStatus] = useState("");
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const active = capabilities[activeCapability]!;
  const install = installModes[installMode]!;
  useEffect(() => () => clearTimeout(copyTimer.current), []);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(install.lines.join("\n"));
      setCopyStatus("Copied");
    } catch {
      setCopyStatus("Select the commands to copy");
    }
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopyStatus(""), 2800);
  };
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <div className="container nav-inner">
          <a className="brand" href="#" aria-label="AgentOS home">
            <Mark />
            <span>
              Agent<span className="brand-os">OS</span>
            </span>
          </a>
          <nav
            aria-label="Main navigation"
            className={menu ? "navigation open" : "navigation"}
          >
            <a href="#system" onClick={() => setMenu(false)}>
              Why AgentOS
            </a>
            <a href="#capabilities" onClick={() => setMenu(false)}>
              Capabilities
            </a>
            <a href={DOCS} target="_blank" rel="noreferrer">
              Documentation <ArrowUpRight size={12} />
            </a>
          </nav>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="github-link"
            aria-label="AgentOS on GitHub"
          >
            <Github size={17} />
            <span>GitHub</span>
            <ArrowUpRight size={13} />
          </a>
          <button
            className="mobile-toggle"
            aria-expanded={menu}
            aria-label={menu ? "Close navigation" : "Open navigation"}
            onClick={() => setMenu(!menu)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
      </header>
      <main id="main">
        <section className="hero container" aria-labelledby="hero-title">
          <div className="hero-content">
            <a
              className="preview-pill"
              href={REPO}
              target="_blank"
              rel="noreferrer"
            >
              <span className="status-dot" /> Built in the open{" "}
              <span className="pill-divider" /> Developer preview{" "}
              <ChevronRight size={13} />
            </a>
            <h1 id="hero-title">
              Give your agents
              <br />a place to run.
            </h1>
            <p className="hero-description">
              The modular operating system for AI agents.
              <br className="desktop-break" /> Connect models, memory, and
              tools.
              <br className="desktop-break" /> Make the whole system yours.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#start">
                <Terminal size={17} /> Start building <ArrowRight size={16} />
              </a>
              <a
                className="button quiet"
                href={DOCS}
                target="_blank"
                rel="noreferrer"
              >
                Read the docs <ArrowUpRight size={15} />
              </a>
            </div>
            <div className="hero-footnote">
              <span>
                <Code2 size={14} /> TypeScript native
              </span>
              <span>
                <Layers3 size={14} /> Modular by design
              </span>
            </div>
          </div>
          <MatrixCore />
          <div className="hero-bottom">
            <span>Your machine. Your models. Your rules.</span>
            <a href="#system">
              Explore the system <ArrowDown size={14} />
            </a>
          </div>
        </section>
        <section
          className="ecosystem-strip"
          aria-label="Built with and connects to"
        >
          <div className="container ecosystem-inner">
            <span className="strip-label">A home for your stack</span>
            <div>
              <span className="tech-logo ts-logo">TS</span> TypeScript
            </div>
            <div>
              <Send size={20} /> Telegram
            </div>
            <div>
              <Database size={20} /> SQLite
            </div>
            <div>
              <Terminal size={20} /> CLI & SSH
            </div>
            <div>
              <Code2 size={21} /> OpenAI-compatible API
            </div>
          </div>
        </section>
        <section className="system-section container" id="system">
          <div className="section-intro">
            <p className="section-kicker">
              <span className="tiny-square" /> Composable from the core
            </p>
            <h2>
              Build an agent.
              <br />
              Not another black box.
            </h2>
            <p>
              Good systems give you room to change your mind.
              <br />
              AgentOS lets you choose the pieces—and replace them
              <br className="desktop-break" /> when something better comes
              along.
            </p>
          </div>
          <div className="principles">
            <article>
              <div className="feature-symbol">
                <Layers3 size={22} />
              </div>
              <h3>Every piece is a plugin.</h3>
              <p>
                Memory, tools, channels, even the orchestrator. Compose
                independent packages into a system that fits your work.
              </p>
            </article>
            <article>
              <div className="feature-symbol">
                <Terminal size={22} />
              </div>
              <h3>Close to your machine.</h3>
              <p>
                Run the host locally. Keep your configuration and state with
                you, and connect the model providers you choose.
              </p>
            </article>
            <article>
              <div className="feature-symbol">
                <Code2 size={22} />
              </div>
              <h3>Built to be taken apart.</h3>
              <p>
                Typed contracts, readable configuration, and a React control
                plane. Extend the runtime without rebuilding the host.
              </p>
            </article>
          </div>
        </section>
        <section className="capabilities-section container" id="capabilities">
          <div className="section-heading">
            <div>
              <p className="section-kicker">
                <span className="tiny-square" /> A system, assembled by you
              </p>
              <h2>Small pieces. Real possibilities.</h2>
            </div>
            <a
              className="text-link"
              href={PACKAGES_REPO}
              target="_blank"
              rel="noreferrer"
            >
              Explore the packages <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="capability-workbench">
            <div
              className="capability-tabs"
              role="tablist"
              aria-label="Agent capabilities"
            >
              {capabilities.map((item, index) => (
                <button
                  key={item.name}
                  id={`capability-tab-${index}`}
                  role="tab"
                  aria-selected={activeCapability === index}
                  aria-controls="capability-panel"
                  tabIndex={activeCapability === index ? 0 : -1}
                  onClick={() => setActiveCapability(index)}
                  onKeyDown={(event) => {
                    const next =
                      event.key === "ArrowRight"
                        ? (index + 1) % capabilities.length
                        : event.key === "ArrowLeft"
                          ? (index + capabilities.length - 1) %
                            capabilities.length
                          : event.key === "Home"
                            ? 0
                            : event.key === "End"
                              ? capabilities.length - 1
                              : -1;
                    if (next >= 0) {
                      event.preventDefault();
                      setActiveCapability(next);
                      document
                        .getElementById(`capability-tab-${next}`)
                        ?.focus();
                    }
                  }}
                >
                  <item.icon size={17} />
                  {item.name}
                </button>
              ))}
            </div>
            <div
              className="capability-panel"
              id="capability-panel"
              role="tabpanel"
              aria-labelledby={`capability-tab-${activeCapability}`}
              tabIndex={0}
            >
              <div className="capability-copy">
                <span className="package-label">
                  @agent-os/{active.package}
                </span>
                <h3>{active.title}</h3>
                <p>{active.description}</p>
                <a
                  className="text-link"
                  href={`${PACKAGES_REPO}/tree/main/${active.package}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  View package <ArrowUpRight size={15} />
                </a>
              </div>
              <div className="capability-visual">
                <div
                  className="flow-diagram"
                  aria-label={active.nodes.join(" connects to ")}
                >
                  {active.nodes.map((node, index) => (
                    <div className="flow-item" key={node}>
                      {index > 0 && (
                        <span className="flow-connector" aria-hidden="true" />
                      )}
                      <div
                        className={
                          index === 1 ? "flow-node central" : "flow-node"
                        }
                      >
                        {index === 1 ? (
                          <Mark small />
                        ) : index === 0 ? (
                          <Database size={18} />
                        ) : (
                          <Network size={18} />
                        )}
                        <span>{node}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="code-preview">
                  <div>
                    <span className="status-dot" /> {active.file}
                    <span>Example</span>
                  </div>
                  <pre>
                    <code>
                      {active.lines.map((line, index) => (
                        <span
                          className="code-line"
                          key={`${active.file}-${index}`}
                        >
                          <span className="line-number" aria-hidden="true">
                            {index + 1}
                          </span>
                          {line}
                        </span>
                      ))}
                    </code>
                  </pre>
                </div>
                <p className="diagram-caption">{active.note}</p>
              </div>
            </div>
          </div>
        </section>
        <section className="start-section container" id="start">
          <div className="start-copy">
            <p className="section-kicker">
              <span className="tiny-square" /> From idea to runtime
            </p>
            <h2>
              Your next agent
              <br />
              starts here.
            </h2>
            <p>
              Clone it. Explore it. Make it do something useful.
              <br />
              There’s a whole system waiting to be yours.
            </p>
            <a
              href={DOCS}
              className="text-link"
              target="_blank"
              rel="noreferrer"
            >
              Runtime setup guide <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="install-terminal">
            <div className="terminal-heading">
              <span className="window-dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span>~/agent-os</span>
              <Terminal size={14} />
            </div>
            <div className="install-tabs" aria-label="Setup options">
              {installModes.map((mode, index) => (
                <button
                  key={mode.name}
                  aria-pressed={installMode === index}
                  onClick={() => {
                    setInstallMode(index);
                    setCopyStatus("");
                  }}
                >
                  {mode.name}
                </button>
              ))}
            </div>
            <div className="terminal-body">
              <p className="code-comment"># {install.title}</p>
              <pre>
                <code>
                  {install.lines.map((line) => (
                    <span className="command-line" key={line}>
                      <span aria-hidden="true">$</span>
                      {line}
                    </span>
                  ))}
                </code>
              </pre>
              <button
                className="copy-button"
                onClick={copy}
                aria-label="Copy setup commands"
              >
                {copyStatus === "Copied" ? (
                  <Check size={14} />
                ) : (
                  <Copy size={14} />
                )}
                {copyStatus || "Copy commands"}
              </button>
              <span className="sr-only" role="status">
                {copyStatus}
              </span>
            </div>
            <p className="install-note">{install.note}</p>
          </div>
        </section>
        <section className="faq-section container">
          <h2>A few things to know.</h2>
          <div className="faq-list">
            <details>
              <summary>
                Is AgentOS tied to a specific model?<span>+</span>
              </summary>
              <p>
                No. The core defines provider-neutral TypeScript contracts. The
                model, agent, and orchestrator are separate interfaces, so you
                can choose or build adapters for your setup.
              </p>
            </details>
            <details>
              <summary>
                Where does my data live?<span>+</span>
              </summary>
              <p>
                The host keeps configuration and runtime state on your machine.
                Connected model providers and external tools receive the data
                required for their calls; this depends on the adapters you
                configure.
              </p>
            </details>
            <details>
              <summary>
                Can I build my own capabilities?<span>+</span>
              </summary>
              <p>
                Yes. The CLI scaffolds typed interfaces, a manifest, and React
                management screens. One package can provide several
                capabilities, including input, output, actions, memory, and
                orchestration.
              </p>
            </details>
            <details>
              <summary>
                What do I need to get started?<span>+</span>
              </summary>
              <p>
                Node.js 22.5 or newer, pnpm, and an npm-compatible registry with
                your capability packages. AgentOS is in active development. The
                setup guide explains the runtime configuration and package
                workflow.
              </p>
            </details>
          </div>
        </section>
        <section className="closing container">
          <Mark />
          <h2>Build something that works for you.</h2>
          <a
            className="button primary"
            href={REPO}
            target="_blank"
            rel="noreferrer"
          >
            <Github size={17} /> Explore AgentOS <ArrowUpRight size={15} />
          </a>
          <p>Built for developers who like to know how things work.</p>
        </section>
      </main>
      <footer className="container footer">
        <a className="brand" href="#">
          <Mark small />
          <span>
            Agent<span className="brand-os">OS</span>
          </span>
        </a>
        <span>A modular runtime. An open canvas.</span>
        <div>
          <a href={DOCS} target="_blank" rel="noreferrer">
            Documentation
          </a>
          <a href={REPO} target="_blank" rel="noreferrer">
            GitHub <ArrowUpRight size={12} />
          </a>
          <a href="#">Back to top ↑</a>
        </div>
      </footer>
    </>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
