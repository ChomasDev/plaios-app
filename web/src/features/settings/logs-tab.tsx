import { useQuery } from "@tanstack/react-query";
import { cn } from "@plaios/microfrontend";
import { useEffect, useRef, useState } from "react";

import { requestJson } from "../../shared/api.js";
import type { HostLogEntry } from "../../shared/types.js";
import { Hint } from "../../shared/ui/hint.js";
import { Notice } from "../../shared/ui/notice.js";
import { PillButton } from "../../shared/ui/pill-button.js";

type Level = "all" | "warn" | "error";
const LEVELS: Array<[Level, string]> = [["all", "All"], ["warn", "Warnings"], ["error", "Errors"]];
const LEVEL_COLOR: Record<HostLogEntry["level"], string> = { debug: "text-muted-foreground", info: "text-foreground/80", warn: "text-amber-600 dark:text-amber-400", error: "text-destructive" };
const TIME = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** The host's last console lines, refreshed while the tab is open. */
export function LogsTab() {
  const [level, setLevel] = useState<Level>("all");
  const [query, setQuery] = useState("");
  const [follow, setFollow] = useState(true);
  // shortcut: refetches the whole 1000-line buffer every 3s; switch to a cursor if this crosses a slow link often.
  const logs = useQuery({ queryKey: ["logs"], queryFn: () => requestJson<HostLogEntry[]>("/api/logs"), refetchInterval: follow ? 3_000 : false });
  const box = useRef<HTMLDivElement>(null);
  const entries = logs.data ?? [];
  const needle = query.trim().toLowerCase();
  const visible = entries.filter((entry) =>
    (level === "all" || entry.level === level || (level === "warn" && entry.level === "error")) &&
    (!needle || entry.text.toLowerCase().includes(needle)));
  const count = (wanted: Level) => entries.filter((entry) => entry.level === wanted || (wanted === "warn" && entry.level === "error")).length;
  // Scroll only the log box, never the page.
  useEffect(() => { if (follow && box.current) box.current.scrollTop = box.current.scrollHeight; }, [follow, visible.length]);

  return <div>
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="flex gap-1 text-sm">
        {LEVELS.map(([value, label]) => <button key={value} type="button" aria-pressed={level === value} onClick={() => setLevel(value)}
          className="rounded-full px-3 py-1 text-muted-foreground transition-colors hover:text-foreground aria-pressed:bg-foreground aria-pressed:text-background">
          {label}{value === "all" ? "" : ` · ${count(value)}`}
        </button>)}
      </div>
      <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter lines" className="field max-w-xs" aria-label="Filter log lines" />
      <PillButton quiet onClick={() => setFollow(!follow)}>{follow ? "Pause" : "Follow"}</PillButton>
      <PillButton quiet onClick={() => void navigator.clipboard.writeText(visible.map(lineText).join("\n"))}>Copy</PillButton>
    </div>
    {logs.isError ? <Notice tone="error">Logs unavailable: {logs.error.message}</Notice> : null}
    {logs.data && visible.length === 0 ? <Hint>No lines match.</Hint> : null}
    <div ref={box} role="log" aria-live="off" className="max-h-[70vh] overflow-auto rounded-xl border bg-muted/30 p-3 font-mono text-xs leading-5">
      {visible.map((entry) => <div key={entry.seq} className="grid grid-cols-[auto_3.5rem_1fr] gap-x-3">
        <span className="text-muted-foreground tabular-nums">{TIME.format(new Date(entry.at))}</span>
        <span className={cn("uppercase", LEVEL_COLOR[entry.level])}>{entry.level}</span>
        <span className={cn("break-words whitespace-pre-wrap", LEVEL_COLOR[entry.level])}>{entry.text}</span>
      </div>)}
    </div>
  </div>;
}

function lineText(entry: HostLogEntry): string {
  return `${entry.at} ${entry.level.toUpperCase()} ${entry.text}`;
}
