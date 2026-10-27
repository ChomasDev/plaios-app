import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import type { ReactNode } from "react";

import { requestJson } from "../../shared/api.js";
import { rise } from "../../shared/motion.js";
import type { StorePackageDetailDto } from "../../shared/types.js";
import { BackLink } from "../../shared/ui/back-link.js";
import { Hint } from "../../shared/ui/hint.js";
import { EmptyState } from "../../shared/ui/empty-state.js";
import { BlankDocScene, UnpluggedScene } from "../../shared/ui/illustrations.js";
import { Markdown } from "../chat/markdown.js";
import { PackageActions } from "./package-actions.js";
import { InstallBadge, KindBadges } from "./package-badges.js";
import { formatBytes, splitName, timeAgo } from "./package-format.js";
import { PackageIcon } from "./package-icon.js";

const VISIBLE_VERSIONS = 8;

export function PackagePage({ name }: { name: string }) {
  const detail = useQuery({ queryKey: ["store", "package", name], queryFn: () => requestJson<StorePackageDetailDto>(`/api/store/package?name=${encodeURIComponent(name)}`) });
  return <div className="mx-auto w-full max-w-6xl px-6 py-8">
    <div className="mb-8"><BackLink href="#store" label="Back to Store" /></div>
    <PackageBody detail={detail} />
  </div>;
}

function PackageBody({ detail }: { detail: ReturnType<typeof useQuery<StorePackageDetailDto>> }) {
  if (detail.isError) return <EmptyState art={<UnpluggedScene />} title="This package could not be read" hint={detail.error.message} />;
  if (!detail.data) return <Hint>Reading package…</Hint>;
  const item = detail.data;
  return <>
    <PackageHeader item={item} />
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <motion.article {...rise(0.05)} className="min-w-0 text-[15px] leading-7">
        {item.readme ? <Markdown document text={item.readme} /> : <EmptyState art={<BlankDocScene />} title="No README yet" hint="The author has not published one for this package." />}
      </motion.article>
      <motion.aside {...rise(0.1)} className="space-y-6 text-sm lg:sticky lg:top-6 lg:self-start">
        <Facts item={item} />
        <Links item={item} />
        <NameList title="Dependencies" names={item.dependencies} />
        <NameList title="Peer dependencies" names={item.peerDependencies} />
        <Versions item={item} />
      </motion.aside>
    </div>
  </>;
}

function PackageHeader({ item }: { item: StorePackageDetailDto }) {
  const { scope, short } = splitName(item.name);
  return <motion.header {...rise()} className="mb-10 flex flex-wrap items-start gap-5 border-b pb-8">
    <PackageIcon large name={item.name} />
    <div className="min-w-0 flex-1">
      <p className="text-xs text-muted-foreground">{scope}</p>
      <h1 className="truncate text-3xl font-semibold tracking-tight">{short}</h1>
      {item.description ? <p className="mt-2 max-w-2xl text-muted-foreground">{item.description}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-xs text-muted-foreground">v{item.version}</span>
        <InstallBadge item={item} />
        <KindBadges item={item} />
      </div>
    </div>
    <PackageActions item={item} />
  </motion.header>;
}

function Facts({ item }: { item: StorePackageDetailDto }) {
  const rows: Array<[string, string | undefined]> = [
    ["Installed", item.installed ? `v${item.installedVersion}${item.instances > 1 ? ` · ${item.instances} instances` : ""}` : undefined],
    ["Latest", `v${item.version}`],
    ["Published", timeAgo(item.updatedAt)],
    ["Created", timeAgo(item.createdAt)],
    ["License", item.license],
    ["Author", item.author],
    ["Size", formatBytes(item.unpackedSize)],
    ["Files", item.fileCount?.toString()],
  ];
  return <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
    {rows.filter((row): row is [string, string] => Boolean(row[1])).map(([label, value]) => <div key={label} className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate">{value}</dd>
    </div>)}
  </dl>;
}

function Links({ item }: { item: StorePackageDetailDto }) {
  const links = [["Repository", item.repository], ["Homepage", item.homepage]].filter((link): link is [string, string] => Boolean(link[1]));
  if (links.length === 0) return null;
  return <SideSection title="Links">
    {links.map(([label, href]) => <a key={label} href={href} target="_blank" rel="noreferrer noopener" className="group flex items-center gap-1.5 truncate text-muted-foreground transition-colors hover:text-foreground">
      <ExternalLink className="icon-nudge-out size-3.5 shrink-0" />{label}
    </a>)}
  </SideSection>;
}

function NameList({ title, names }: { title: string; names: string[] }) {
  if (names.length === 0) return null;
  return <SideSection title={`${title} · ${names.length}`}>
    <div className="flex flex-wrap gap-1.5">{names.map((name) => <span key={name} className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px]">{name}</span>)}</div>
  </SideSection>;
}

function Versions({ item }: { item: StorePackageDetailDto }) {
  return <SideSection title={`Versions · ${item.versions.length}`}>
    <ul className="space-y-1.5">
      {item.versions.slice(0, VISIBLE_VERSIONS).map((entry) => <li key={entry.version} className="flex items-baseline justify-between gap-3">
        <span className={entry.version === item.installedVersion ? "font-mono text-xs font-medium" : "font-mono text-xs text-muted-foreground"}>
          {entry.version}{entry.version === item.installedVersion ? " · installed" : ""}
        </span>
        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(entry.date)}</span>
      </li>)}
    </ul>
  </SideSection>;
}

function SideSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-2 border-t pt-5">
    <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{title}</h2>
    {children}
  </section>;
}
