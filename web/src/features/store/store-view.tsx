import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CircleArrowUp, CircleCheck, Search, Sparkles, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { requestJson } from "../../shared/api.js";
import { kindLabels } from "../../shared/health.js";
import { kindIcons } from "../../shared/kind-icons.js";
import { SNAPPY } from "../../shared/motion.js";
import type { InterfaceKind, StorePackageDto } from "../../shared/types.js";
import { EmptyState } from "../../shared/ui/empty-state.js";
import { NoResultsScene, UnpluggedScene } from "../../shared/ui/illustrations.js";
import { PillButton } from "../../shared/ui/pill-button.js";
import { Page } from "../../shared/ui/page.js";
import { PackageCard } from "./package-card.js";

type Filter = "all" | "installed" | "updates" | InterfaceKind;

export function StoreView({ initialQuery = "" }: { initialQuery?: string }) {
  // `#store/<kind>` (the Build page's "Add" tiles) opens on that kind's filter.
  const kindLink = initialQuery in kindLabels;
  const [query, setQuery] = useState(kindLink ? "" : initialQuery);
  const [filter, setFilter] = useState<Filter>(kindLink ? initialQuery as InterfaceKind : "all");
  const store = useQuery({ queryKey: ["store"], queryFn: () => requestJson<StorePackageDto[]>("/api/store") });
  return <Page wide title="Store" intro="Discover plugins published to your registry.">
    <SearchField value={query} onChange={setQuery} />
    {store.data ? <FilterChips items={store.data} active={filter} onChange={setFilter} /> : null}
    <StoreGrid store={store} query={query} filter={filter} onReset={() => { setQuery(""); setFilter("all"); }} />
  </Page>;
}

function StoreGrid({ store, query, filter, onReset }: { store: ReturnType<typeof useQuery<StorePackageDto[]>>; query: string; filter: Filter; onReset(): void }) {
  if (store.isError) return <EmptyState art={<UnpluggedScene />} title="The registry is not answering" hint={store.error.message}><PillButton onClick={() => void store.refetch()}>Try again</PillButton></EmptyState>;
  if (!store.data) return <CardSkeletons />;
  const needle = query.trim().toLowerCase();
  const items = store.data
    .filter((item) => matchesFilter(item, filter))
    .filter((item) => `${item.name} ${item.description ?? ""} ${item.keywords.join(" ")}`.toLowerCase().includes(needle));
  if (items.length === 0) return <EmptyState art={<NoResultsScene />} title="No plugins match" hint="Try another word, or look through every plugin."><PillButton quiet onClick={onReset}>Clear filters</PillButton></EmptyState>;
  return <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {items.map((item, index) => <PackageCard key={item.name} item={item} index={index} />)}
  </ul>;
}

function matchesFilter(item: StorePackageDto, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "installed") return item.installed;
  if (filter === "updates") return item.updateAvailable;
  return item.kinds.includes(filter);
}

/** Only filters that match something are offered; the active pill slides between them. */
function FilterChips({ items, active, onChange }: { items: StorePackageDto[]; active: Filter; onChange(filter: Filter): void }) {
  const kinds = [...new Set(items.flatMap((item) => item.kinds))];
  const filters: Array<[Filter, string, LucideIcon]> = [
    ["all", "All", Sparkles],
    ["installed", "Installed", CircleCheck],
    ...(items.some((item) => item.updateAvailable) ? [["updates", "Updates", CircleArrowUp] as [Filter, string, LucideIcon]] : []),
    ...kinds.map((kind) => [kind, kindLabels[kind], kindIcons[kind]] as [Filter, string, LucideIcon]),
  ];
  return <div role="tablist" aria-label="Filter plugins" className="mb-6 flex flex-wrap gap-1 text-sm">
    {filters.map(([filter, label, Icon]) => <button
      key={filter}
      type="button"
      role="tab"
      aria-selected={filter === active}
      onClick={() => onChange(filter)}
      className="group relative rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground aria-selected:text-background"
    >
      {filter === active ? <motion.span layoutId="store-filter-pill" transition={SNAPPY} className="absolute inset-0 rounded-full bg-foreground" /> : null}
      <span className="relative flex items-center gap-1.5"><Icon className="icon-bounce size-3.5" />{label}</span>
    </button>)}
  </div>;
}

function SearchField({ value, onChange }: { value: string; onChange(value: string): void }) {
  return <label className="group mb-4 flex items-center gap-3 rounded-2xl border bg-background/60 px-4 py-3 transition-colors focus-within:border-foreground/40">
    <Search className="icon-wiggle size-4 text-muted-foreground" />
    <input value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search plugins, keywords, kinds…" aria-label="Search plugins" className="w-full bg-transparent outline-none" />
  </label>;
}

function CardSkeletons() {
  return <ul aria-label="Loading" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: 6 }, (_, index) => <li key={index} className="h-40 animate-pulse rounded-2xl bg-muted/60" />)}
  </ul>;
}
