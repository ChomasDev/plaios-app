import { cn } from "@agent-os/microfrontend";
import { AnimatePresence, motion } from "framer-motion";
import { History, LayoutGrid, Package, Settings, X, type LucideIcon } from "lucide-react";

import { componentHealth } from "../shared/health.js";
import { SNAPPY } from "../shared/motion.js";
import type { RuntimeComponentDto } from "../shared/types.js";
import { StatusDot } from "../shared/ui/status-dot.js";
import type { Route, View } from "./routes.js";
import { ThemeToggle } from "./theme-toggle.js";

const NAV: Array<{ view: View; label: string; icon: LucideIcon; motion: string }> = [
  { view: "components", label: "Build", icon: LayoutGrid, motion: "icon-grid" },
  { view: "store", label: "Store", icon: Package, motion: "icon-bounce" },
  { view: "settings", label: "Settings", icon: Settings, motion: "icon-gear" },
];

/** No bar: a few controls float in the chat's corners, under the sheets. */
export function AppHeader({ route, components, theme }: { route: Route; components?: RuntimeComponentDto[]; theme: { dark: boolean; setDark(dark: boolean): void } }) {
  return <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between p-3 sm:p-4 *:pointer-events-auto">
    <HistoryButton active={route.view === "history"} />
    <div className="flex items-center gap-1">
      <RuntimeStatus components={components} />
      <a href="#components" aria-label="Build" className={ICON_BUTTON}><LayoutGrid className="icon-grid size-4" /></a>
      <ThemeToggle dark={theme.dark} onChange={theme.setDark} />
    </div>
  </header>;
}

const ICON_BUTTON = "group grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground aria-[current]:bg-muted aria-[current]:text-foreground";

function HistoryButton({ active }: { active: boolean }) {
  return <a
    href={active ? "#chat" : "#history"}
    aria-label="Conversations"
    aria-current={active ? "page" : undefined}
    className={ICON_BUTTON}
  ><History className="icon-rewind size-4" /></a>;
}

/** Tabs at the top of the manage sheet; the active pill slides between them instead of blinking. */
export function ManageNav({ active }: { active: View }) {
  return <div className="flex items-center justify-between px-6 pt-5">
    <MainNav active={active} />
    <a href="#chat" aria-label="Back to chat" className={ICON_BUTTON}><X className="icon-turn size-4" /></a>
  </div>;
}

function MainNav({ active }: { active: View }) {
  return <nav aria-label="Main" className="-ml-3 flex gap-0.5 text-sm">
    {NAV.map((item) => <a
      key={item.view}
      href={`#${item.view}`}
      aria-current={item.view === active ? "page" : undefined}
      className="group relative rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground aria-[current]:text-foreground"
    >
      {item.view === active ? <motion.span layoutId="main-nav-pill" transition={SNAPPY} className="absolute inset-0 rounded-full bg-muted" /> : null}
      <span className="relative flex items-center gap-1.5"><item.icon className={`${item.motion} size-3.5`} />{item.label}</span>
    </a>)}
  </nav>;
}

function RuntimeStatus({ components }: { components?: RuntimeComponentDto[] }) {
  const faulted = components?.filter((item) => componentHealth(item) === "error").length ?? 0;
  return <AnimatePresence initial={false}>
    {components ? <motion.a
      key="status"
      href="#components"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn("group mr-2 hidden items-center gap-2 text-xs transition-colors hover:text-foreground sm:flex", faulted ? "text-destructive" : "text-muted-foreground")}
    >
      <StatusDot health={faulted ? "error" : "online"} />
      {faulted ? `${faulted} need attention` : "All running"}
    </motion.a> : null}
  </AnimatePresence>;
}
