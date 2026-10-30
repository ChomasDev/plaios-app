import { cn } from "@plaios/microfrontend";

import { usePackageDetail } from "../../shared/api.js";
import { timeAgo } from "../store/package-format.js";

export const SELECT = "h-8 min-w-0 rounded-full border bg-background px-3 font-mono text-xs outline-none focus:border-foreground/40 disabled:opacity-50";

/** Every published version of a package, newest first, with the installed and latest ones marked. */
export function VersionSelect({ name, installed, latest, value, onChange, disabled, className }: {
  name: string;
  installed?: string;
  latest?: string;
  value: string;
  onChange(version: string): void;
  disabled?: boolean;
  className?: string;
}) {
  const detail = usePackageDetail(name);
  // Until the registry answers, the two known versions keep the select usable.
  const versions = detail.data?.versions ?? [...new Set([latest, installed].filter((item): item is string => Boolean(item)))].map((version) => ({ version, date: undefined }));
  return <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} aria-label={`Version of ${name}`} className={cn(SELECT, className)}>
    {versions.map(({ version, date }) => <option key={version} value={version}>
      {version}{version === installed ? " · installed" : version === latest ? " · latest" : ""}{date ? ` · ${timeAgo(date)}` : ""}
    </option>)}
  </select>;
}
