import { cpus, freemem, hostname, loadavg, totalmem } from "node:os";

import type { AgentRunDto, TelemetryDto } from "./types.js";

const RECENT_LIMIT = 200;

// shortcut: in-memory only, resets when the control plane restarts; persist to the database if history across restarts is needed.
export class Telemetry {
  private readonly startedAt = new Date();
  private readonly recent: AgentRunDto[] = [];
  private total = 0;
  private failed = 0;

  record(run: AgentRunDto): void {
    this.total += 1;
    if (!run.ok) this.failed += 1;
    this.recent.unshift(run);
    if (this.recent.length > RECENT_LIMIT) this.recent.length = RECENT_LIMIT;
  }

  snapshot(): TelemetryDto {
    const memory = process.memoryUsage();
    return {
      startedAt: this.startedAt.toISOString(),
      uptimeSec: Math.round(process.uptime()),
      host: {
        hostname: hostname(),
        platform: `${process.platform}/${process.arch}`,
        node: process.version,
        cpus: cpus().length,
        loadavg: loadavg() as [number, number, number],
        memoryTotal: totalmem(),
        memoryFree: freemem(),
        rss: memory.rss,
        heapUsed: memory.heapUsed,
      },
      runs: { total: this.total, failed: this.failed, recent: [...this.recent] },
    };
  }
}
