import { format } from "node:util";

import type { HostLogEntry } from "./types.js";

const LIMIT = 1_000;
const METHODS = [["debug", "debug"], ["log", "info"], ["info", "info"], ["warn", "warn"], ["error", "error"]] as const;

/** The last host console lines, so Settings can show them without a shell on the machine. */
export class HostLogs {
  private readonly entries: HostLogEntry[] = [];
  private seq = 0;

  record(level: HostLogEntry["level"], args: readonly unknown[]): void {
    this.entries.push({ seq: ++this.seq, at: new Date().toISOString(), level, text: format(...args) });
    if (this.entries.length > LIMIT) this.entries.shift();
  }

  /** Oldest first. */
  list(): HostLogEntry[] {
    return [...this.entries];
  }

  /** Tees the console into the buffer; the terminal still gets every line. */
  capture(target: Console = console): void {
    for (const [method, level] of METHODS) {
      const original = target[method].bind(target);
      target[method] = (...args: unknown[]) => { this.record(level, args); original(...args); };
    }
  }
}
