const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const STEPS: Array<[Intl.RelativeTimeFormatUnit, number]> = [["year", 31_536_000], ["month", 2_592_000], ["week", 604_800], ["day", 86_400], ["hour", 3_600], ["minute", 60]];

/** `@plaios/action-ssh` → `{ scope: "@plaios", short: "action-ssh" }`. */
export function splitName(name: string): { scope?: string; short: string } {
  const match = /^(@[^/]+)\/(.+)$/.exec(name);
  return match ? { scope: match[1], short: match[2]! } : { short: name };
}

export function timeAgo(iso?: string): string | undefined {
  if (!iso) return undefined;
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  if (Number.isNaN(seconds)) return undefined;
  for (const [unit, size] of STEPS) {
    if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function formatBytes(bytes?: number): string | undefined {
  if (bytes === undefined) return undefined;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
