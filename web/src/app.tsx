import { CapabilityMicrofrontend, type MicrofrontendComponent } from "@agent-os/microfrontend";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Bot, Braces, BrainCircuit, CircleGauge, Database, Download, Grid2X2, Layers3, Moon, PackageCheck, Plug, Radio, RefreshCw, Search, ShoppingBag, Sparkles, Sun, Trash2, Wrench } from "lucide-react";
import { Component, Suspense, lazy, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import type { BridgeActionMarker, RuntimeComponentDto, RuntimeSnapshot, StorePackageDto } from "../../src/types.js";

const kindIcons = { env: Braces, ai: Sparkles, discovery: CircleGauge, database: Database, memory: BrainCircuit, orchestrator: Grid2X2, agent: Bot, input: Radio, output: Plug, action: Wrench } as const;
type View = "components" | "store";

export function App() {
  const queryClient = useQueryClient();
  const runtime = useQuery({ queryKey: ["runtime"], queryFn: () => requestJson<RuntimeSnapshot>("/api/runtime"), refetchInterval: 30_000 });
  const components = runtime.data?.components ?? [];
  const initialHash = decodeURIComponent(location.hash.slice(1));
  const [view, setView] = useState<View>(initialHash === "store" ? "store" : "components");
  const [selectedId, setSelectedId] = useState(initialHash === "store" ? "" : initialHash);
  const [dark, setDark] = useState(() => localStorage.getItem("agent-os-theme") !== "light");

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("agent-os-theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { if (components.length && view === "components" && !components.some((item) => item.instanceId === selectedId)) setSelectedId(components[0]!.instanceId); }, [components, selectedId, view]);
  useEffect(() => { history.replaceState(null, "", view === "store" ? "#store" : selectedId ? `#${encodeURIComponent(selectedId)}` : "#components"); }, [selectedId, view]);

  const selected = components.find((item) => item.instanceId === selectedId);
  const kinds = new Set(components.map(({ kind }) => kind)).size;
  const navigateToComponent = (instanceId: string) => { setSelectedId(instanceId); setView("components"); };

  return <div className="min-h-svh w-full bg-background lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
    <aside className="border-b bg-background/95 lg:sticky lg:top-0 lg:flex lg:h-svh lg:flex-col lg:border-r lg:border-b-0">
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="grid size-9 shrink-0 place-items-center bg-primary text-primary-foreground"><Boxes className="size-4" /></div>
        <div className="min-w-0"><p className="truncate font-heading text-sm font-semibold tracking-tight">AgentOS Dynamic</p><p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Control plane</p></div>
        <span className={`ml-auto size-2 ${runtime.isSuccess ? "bg-emerald-500" : "bg-destructive"}`} title={runtime.isSuccess ? "Runtime online" : "Runtime offline"} />
      </div>
      <div className="grid grid-cols-2 gap-1 border-b p-3 lg:block lg:space-y-1">
        <NavButton active={view === "components"} icon={Layers3} label="Components" meta={String(components.length).padStart(2, "0")} onClick={() => setView("components")} />
        <NavButton active={view === "store"} icon={ShoppingBag} label="Store" meta="Registry" onClick={() => setView("store")} />
      </div>
      <nav className="flex gap-3 overflow-x-auto border-b p-3 lg:min-h-0 lg:flex-1 lg:block lg:space-y-5 lg:overflow-y-auto lg:border-b-0 lg:p-4">
        {groupComponents(components).map(([kind, entries]) => { const Icon = kindIcons[kind]; return <section key={kind} className="min-w-52 lg:min-w-0">
          <p className="mb-2 flex items-center gap-2 px-1 text-[9px] uppercase tracking-[0.16em] text-muted-foreground"><Icon className="size-3" />{kind}</p>
          <div className="space-y-1">{entries.map((item) => <button key={item.instanceId} type="button" onClick={() => navigateToComponent(item.instanceId)} className={`flex min-h-11 w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors ${view === "components" && item.instanceId === selectedId ? "border-foreground/25 bg-foreground text-background" : "border-transparent hover:border-border hover:bg-muted/50"}`}>
            <span className={`size-1.5 shrink-0 ${item.runtimeError ? "bg-destructive" : "bg-emerald-500"}`} /><span className="min-w-0 flex-1"><span className="block truncate font-mono text-[11px] font-medium">{item.id}</span><span className={`block truncate text-[9px] ${view === "components" && item.instanceId === selectedId ? "text-background/60" : "text-muted-foreground"}`}>{item.instanceId}</span></span>
          </button>)}</div>
        </section>; })}
      </nav>
      <div className="hidden border-t p-4 lg:block">
        <div className="grid grid-cols-2 gap-px border bg-border"><SidebarMetric label="Components" value={String(components.length).padStart(2, "0")} /><SidebarMetric label="Kinds" value={String(kinds).padStart(2, "0")} /></div>
        {runtime.data ? <><p className="mt-4 text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Registry</p><code className="mt-1 block truncate text-[9px] text-foreground/70" title={runtime.data.registry}>{runtime.data.registry}</code></> : null}
      </div>
    </aside>
    <section className="min-w-0">
      <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-xl md:px-6">
        <div className="min-w-0"><p className="truncate font-heading text-sm font-semibold">{view === "store" ? "Capability Store" : selected?.instanceId ?? "Components"}</p><p className="hidden text-[9px] uppercase tracking-[0.14em] text-muted-foreground sm:block">{view === "store" ? "Install from your AgentOS registry" : selected ? `${selected.kind} · ${selected.packageName}@${selected.version}` : "Manifest-driven runtime"}</p></div>
        <span className="ml-auto hidden items-center gap-2 border px-2 py-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:flex"><span className={`size-1.5 ${runtime.isSuccess ? "bg-emerald-500" : "bg-destructive"}`} />{runtime.isSuccess ? "Runtime online" : "Connecting"}</span>
        <button type="button" className="grid size-9 place-items-center border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => void Promise.all([queryClient.invalidateQueries({ queryKey: ["runtime"] }), queryClient.invalidateQueries({ queryKey: ["store"] })])} aria-label="Refresh"><RefreshCw className={`size-3.5 ${runtime.isFetching ? "animate-spin" : ""}`} /></button>
        <button type="button" className="grid size-9 place-items-center border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => setDark((value) => !value)} aria-label="Toggle theme">{dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}</button>
      </header>
      <main className="min-w-0">{runtime.isError ? <ErrorPanel title="Runtime API unavailable" error={runtime.error} /> : runtime.isLoading ? <LoadingPanel label="Loading runtime graph…" /> : view === "store" ? <StoreView registry={runtime.data?.registry ?? ""} /> : !selected ? <EmptyRuntime onOpenStore={() => setView("store")} /> : <>
        <div className="flex flex-col gap-3 border-b bg-background/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8"><div className="min-w-0"><p className="text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Active component</p><p className="mt-1 truncate font-mono text-xs">{selected.packageName}@{selected.version}</p></div><label className="flex items-center gap-3 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Swap view<select value={selected.instanceId} onChange={(event) => navigateToComponent(event.target.value)} className="h-8 max-w-72 border bg-background px-2 font-mono text-[11px] normal-case tracking-normal text-foreground outline-none focus:border-ring">{components.map((item) => <option key={item.instanceId} value={item.instanceId}>{item.kind} · {item.instanceId}</option>)}</select></label></div>
        <SurfaceBoundary key={selected.instanceId}><DynamicSurface component={selected} /></SurfaceBoundary>
      </>}</main>
    </section>
  </div>;
}

function StoreView({ registry }: { registry: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const store = useQuery({ queryKey: ["store"], queryFn: () => requestJson<StorePackageDto[]>("/api/store") });
  const mutation = useMutation({ mutationFn: ({ action, packageName, version }: { action: "install" | "uninstall"; packageName: string; version?: string }) => requestJson<RuntimeSnapshot>(`/api/store/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packageName, version }) }), onSuccess: async () => { await Promise.all([queryClient.invalidateQueries({ queryKey: ["runtime"] }), queryClient.invalidateQueries({ queryKey: ["store"] })]); } });
  const packages = (store.data ?? []).filter((item) => `${item.name} ${item.description ?? ""} ${item.keywords.join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const installed = store.data?.filter((item) => item.installed).length ?? 0;
  return <div className="p-5 md:p-8 xl:p-10">
    <div className="flex flex-col gap-6 border-b pb-8 xl:flex-row xl:items-end xl:justify-between"><div className="max-w-2xl"><p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Registry catalog</p><h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight md:text-4xl">Build your runtime.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Install versioned capabilities and let AgentOS discover their runtime contracts, settings, and management surfaces automatically.</p></div><div className="grid min-w-64 grid-cols-2 gap-px border bg-border"><SidebarMetric label="Available" value={String(store.data?.length ?? 0).padStart(2, "0")} /><SidebarMetric label="Installed" value={String(installed).padStart(2, "0")} /></div></div>
    <div className="mt-7 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center"><label className="flex h-10 w-full max-w-xl items-center gap-3 border bg-background px-3"><Search className="size-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search capabilities, packages, keywords…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label><code className="truncate text-[10px] text-muted-foreground sm:ml-auto" title={registry}>{registry}</code></div>
    {mutation.isError ? <div className="mt-5 border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">{mutation.error.message}</div> : null}
    {store.isLoading ? <LoadingPanel label="Reading registry catalog…" /> : store.isError ? <ErrorPanel title="Store unavailable" error={store.error} /> : packages.length === 0 ? <div className="grid min-h-64 place-items-center border border-dashed text-sm text-muted-foreground">No matching capabilities.</div> : <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{packages.map((item) => <StoreCard key={item.name} item={item} busy={mutation.isPending && mutation.variables.packageName === item.name} onInstall={() => mutation.mutate({ action: "install", packageName: item.name, version: item.version })} onUninstall={() => { if (window.confirm(`Uninstall ${item.name} and remove its component configuration?`)) mutation.mutate({ action: "uninstall", packageName: item.name }); }} />)}</div>}
  </div>;
}

function StoreCard({ item, busy, onInstall, onUninstall }: { item: StorePackageDto; busy: boolean; onInstall(): void; onUninstall(): void }) {
  return <article className="flex min-h-64 flex-col border bg-card p-5"><div className="flex items-start justify-between gap-4"><div className={`grid size-10 place-items-center border ${item.installed ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{item.installed ? <PackageCheck className="size-4" /> : <Boxes className="size-4" />}</div><span className={`border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${item.installed ? "border-emerald-500/30 text-emerald-500" : "text-muted-foreground"}`}>{item.installed ? `${item.instances} active` : "Available"}</span></div><h2 className="mt-5 break-all font-mono text-sm font-semibold">{item.name}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description ?? "AgentOS capability package"}</p><div className="mt-4 flex flex-wrap gap-1.5">{item.keywords.filter((keyword) => keyword !== "agent-os" && keyword !== "capability").slice(0, 4).map((keyword) => <span key={keyword} className="border px-2 py-1 text-[9px] text-muted-foreground">{keyword}</span>)}</div><div className="mt-auto flex items-end justify-between gap-4 border-t pt-5"><div><p className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Latest version</p><p className="mt-1 font-mono text-xs">v{item.version}</p></div><button disabled={busy} type="button" onClick={item.installed ? onUninstall : onInstall} className={`inline-flex h-9 items-center gap-2 border px-3 text-[10px] font-medium uppercase tracking-[0.1em] transition-colors disabled:opacity-50 ${item.installed ? "border-destructive/35 text-destructive hover:bg-destructive/10" : "bg-primary text-primary-foreground hover:bg-primary/85"}`}>{busy ? <RefreshCw className="size-3.5 animate-spin" /> : item.installed ? <Trash2 className="size-3.5" /> : <Download className="size-3.5" />}{busy ? "Working" : item.installed ? "Uninstall" : "Install"}</button></div></article>;
}

function NavButton({ active, icon: Icon, label, meta, onClick }: { active: boolean; icon: typeof Layers3; label: string; meta: string; onClick(): void }) { return <button type="button" onClick={onClick} className={`flex min-h-11 w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors ${active ? "border-foreground/25 bg-muted" : "border-transparent hover:border-border hover:bg-muted/40"}`}><Icon className="size-4" /><span className="text-xs font-medium">{label}</span><span className="ml-auto text-[8px] uppercase tracking-[0.12em] text-muted-foreground">{meta}</span></button>; }

function DynamicSurface({ component }: { component: RuntimeComponentDto }) {
  const queryClient = useQueryClient();
  const dataQuery = useQuery({ queryKey: ["component-data", component.instanceId], queryFn: async () => hydrateBridge(await requestJson<unknown>(`/api/components/${encodeURIComponent(component.instanceId)}/data`), component.instanceId), enabled: component.hasDataBridge });
  useComponentStyles(component.web?.styleUrl);
  const Microfrontend = useMemo(() => { if (!component.web) return CapabilityMicrofrontend as MicrofrontendComponent; return lazy(async () => { const module = await import(/* @vite-ignore */ component.web!.moduleUrl) as Record<string, unknown>; const exported = module[component.web!.exportName] ?? module.default; if (typeof exported !== "function") throw new Error(`Microfrontend export ${component.web!.exportName} was not found`); return { default: exported as MicrofrontendComponent }; }); }, [component.web]);
  const componentInstance = { instanceId: component.instanceId, kind: component.kind, id: component.id, packageId: component.packageId, version: component.version, config: component.config };
  return <>{component.runtimeError ? <div className="mx-5 mt-5 border border-destructive/30 bg-destructive/5 p-4 md:mx-8"><p className="text-xs font-medium text-destructive">Runtime is waiting for configuration</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{component.runtimeError}</p></div> : null}<Suspense fallback={<LoadingPanel label="Loading package microfrontend…" />}><Microfrontend component={componentInstance} data={dataQuery.data} onSaveConfig={async (config) => { await requestJson("/api/configuration", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ instanceId: component.instanceId, config }) }); await Promise.all([queryClient.invalidateQueries({ queryKey: ["runtime"] }), queryClient.invalidateQueries({ queryKey: ["component-data", component.instanceId] })]); }} /></Suspense></>;
}

function useComponentStyles(styleUrl?: string) { useEffect(() => { if (!styleUrl) return; const link = document.createElement("link"); link.rel = "stylesheet"; link.href = styleUrl; link.dataset.agentOsCapabilityStyle = "true"; document.head.append(link); return () => link.remove(); }, [styleUrl]); }
function hydrateBridge(value: unknown, instanceId: string): unknown { if (Array.isArray(value)) return value.map((item) => hydrateBridge(item, instanceId)); if (!value || typeof value !== "object") return value; if ("__agentOsAction" in value && typeof (value as BridgeActionMarker).__agentOsAction === "string") { const path = (value as BridgeActionMarker).__agentOsAction; return (...args: unknown[]) => requestJson(`/api/components/${encodeURIComponent(instanceId)}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, args }) }); } return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, hydrateBridge(item, instanceId)])); }
function groupComponents(components: RuntimeComponentDto[]) { const groups = new Map<RuntimeComponentDto["kind"], RuntimeComponentDto[]>(); for (const item of components) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]); return [...groups.entries()]; }
function SidebarMetric({ label, value }: { label: string; value: string }) { return <div className="bg-background p-3"><p className="font-mono text-xl">{value}</p><p className="mt-1 text-[8px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p></div>; }
function LoadingPanel({ label }: { label: string }) { return <div className="grid min-h-[55svh] place-items-center p-8 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>; }
function ErrorPanel({ title, error }: { title: string; error: unknown }) { return <div className="m-5 border border-destructive/30 bg-destructive/5 p-5 md:m-8"><p className="font-medium text-destructive">{title}</p><p className="mt-2 text-xs text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p></div>; }
function EmptyRuntime({ onOpenStore }: { onOpenStore(): void }) { return <div className="grid min-h-[70svh] place-items-center p-8 text-center"><div><Boxes className="mx-auto size-7 text-muted-foreground" /><h1 className="mt-4 text-xl font-semibold">No components installed</h1><p className="mt-2 text-sm text-muted-foreground">Choose a capability from your registry to assemble this runtime.</p><button type="button" onClick={onOpenStore} className="mt-5 inline-flex h-9 items-center gap-2 bg-primary px-4 text-xs text-primary-foreground"><ShoppingBag className="size-3.5" />Open Store</button></div></div>; }
class SurfaceBoundary extends Component<{ children: ReactNode }, { error?: Error }> { state: { error?: Error } = {}; static getDerivedStateFromError(error: Error) { return { error }; } componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); } render() { return this.state.error ? <ErrorPanel title="Microfrontend failed to load" error={this.state.error} /> : this.props.children; } }
async function requestJson<T = unknown>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, init); const body = await response.json() as T & { error?: string }; if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`); return body; }
