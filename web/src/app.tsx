import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  CapabilityMicrofrontend,
  type MicrofrontendComponent,
} from "@agent-os/microfrontend";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Boxes, Bot, Braces, BrainCircuit, ChevronRight, CircleGauge, Command, Database, Download, GitBranch, Grid2X2, Layers3, Moon, PackageCheck, PanelLeftClose, PanelLeftOpen, Plug, Radio, RefreshCw, Search, Settings, ShoppingBag, Sparkles, Sun, Terminal, Trash2, Wrench, X } from "lucide-react";
import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useState, type ErrorInfo, type ReactNode } from "react";
import type { BridgeActionMarker, HostSettingsDto, HostUpdateResult, RuntimeComponentDto, RuntimeSnapshot, StoreMutationResult, StorePackageDto } from "../../src/types.js";

const kindIcons = { env: Braces, ai: Sparkles, discovery: CircleGauge, database: Database, memory: BrainCircuit, orchestrator: Grid2X2, agent: Bot, input: Radio, output: Plug, action: Wrench } as const;
type View = "components" | "store" | "settings";

function parseLocationHash(hash = location.hash): { view: View; selectedId: string } {
  const value = decodeURIComponent(hash.replace(/^#/, ""));
  if (value === "store") return { view: "store", selectedId: "" };
  if (value === "settings") return { view: "settings", selectedId: "" };
  if (!value || value === "components") return { view: "components", selectedId: "" };
  return { view: "components", selectedId: value };
}

export function App() {
  const queryClient = useQueryClient();
  const runtime = useQuery({ queryKey: ["runtime"], queryFn: () => requestJson<RuntimeSnapshot>("/api/runtime"), refetchInterval: 30_000 });
  const components = runtime.data?.components ?? [];
  const initialLocation = parseLocationHash();
  const [view, setView] = useState<View>(initialLocation.view);
  const [selectedId, setSelectedId] = useState(initialLocation.selectedId);
  const [dark, setDark] = useState(() => localStorage.getItem("agent-os-theme") !== "light");
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(() => localStorage.getItem("agent-os-sidebar") !== "closed");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia("(min-width: 1024px)").matches);

  const toggleSidebar = useCallback(() => {
    if (isDesktop) setDesktopSidebarOpen((value) => !value);
    else setMobileSidebarOpen((value) => !value);
  }, [isDesktop]);

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); localStorage.setItem("agent-os-theme", dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { localStorage.setItem("agent-os-sidebar", desktopSidebarOpen ? "open" : "closed"); }, [desktopSidebarOpen]);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const update = () => { setIsDesktop(media.matches); if (media.matches) setMobileSidebarOpen(false); };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mobileSidebarOpen]);
  useEffect(() => { if (components.length && view === "components" && !components.some((item) => item.instanceId === selectedId)) setSelectedId(components[0]!.instanceId); }, [components, selectedId, view]);
  useEffect(() => { history.replaceState(null, "", view === "store" ? "#store" : view === "settings" ? "#settings" : selectedId ? `#${encodeURIComponent(selectedId)}` : "#components"); }, [selectedId, view]);
  useEffect(() => {
    const onHashChange = () => {
      const next = parseLocationHash();
      setView(next.view);
      setSelectedId(next.selectedId);
      setMobileSidebarOpen(false);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
        event.preventDefault();
        toggleSidebar();
      }
      if (event.key === "Escape") { setCommandOpen(false); setMobileSidebarOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleSidebar]);

  const selected = components.find((item) => item.instanceId === selectedId);
  const kinds = new Set(components.map(({ kind }) => kind)).size;
  const navigateToComponent = (instanceId: string) => { setSelectedId(instanceId); setView("components"); setCommandOpen(false); setMobileSidebarOpen(false); };
  const navigateToView = (nextView: View) => { setView(nextView); setMobileSidebarOpen(false); };
  const commandMatches = components.filter((item) => `${item.instanceId} ${item.packageName} ${item.kind} ${item.id}`.toLowerCase().includes(commandQuery.toLowerCase()));

  return <div className={`agentos-shell min-h-svh w-full bg-background ${desktopSidebarOpen ? "agentos-sidebar-open" : "agentos-sidebar-collapsed"}`}>
    {mobileSidebarOpen ? <button type="button" className="agentos-sidebar-scrim" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)} /> : null}
    <aside id="agentos-navigation" className={`agentos-sidebar border-r bg-background/95 ${mobileSidebarOpen ? "mobile-open" : ""}`} aria-label="AgentOS navigation">
      <div className="agentos-topbar flex h-16 items-center gap-3 border-b px-4">
        <div className="grid size-9 shrink-0 place-items-center border bg-muted text-foreground"><Terminal className="size-4" /></div>
        <div className="min-w-0"><p className="truncate font-mono text-xs font-semibold tracking-tight">agentos://runtime</p><p className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground">Dynamic control plane</p></div>
        <span className={`ml-auto size-2 shrink-0 ${runtime.isSuccess ? "bg-emerald-500" : "bg-destructive"}`} title={runtime.isSuccess ? "Runtime online" : "Runtime offline"} />
        <button type="button" className="grid size-8 shrink-0 place-items-center border text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden" onClick={() => setMobileSidebarOpen(false)} aria-label="Close sidebar"><X className="size-3.5" /></button>
      </div>
      <div className="space-y-1 border-b p-3">
        <NavButton active={view === "components"} icon={Layers3} label="Components" meta={String(components.length).padStart(2, "0")} onClick={() => navigateToView("components")} />
        <NavButton active={view === "store"} icon={ShoppingBag} label="Store" meta="Registry" onClick={() => navigateToView("store")} />
        <NavButton active={view === "settings"} icon={Settings} label="Settings" meta="Host" onClick={() => navigateToView("settings")} />
      </div>
      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        {groupComponents(components).map(([kind, entries]) => { const Icon = kindIcons[kind]; return <section key={kind}>
          <p className="mb-2 flex items-center gap-2 px-1 text-[9px] uppercase tracking-[0.16em] text-muted-foreground"><Icon className="size-3" />{kind}</p>
          <div className="space-y-1">{entries.map((item) => <button key={item.instanceId} type="button" onClick={() => navigateToComponent(item.instanceId)} className={`group flex min-h-10 w-full items-center gap-2.5 border px-2.5 py-2 text-left transition-colors ${view === "components" && item.instanceId === selectedId ? "border-emerald-500/25 bg-emerald-500/[.07] text-foreground shadow-[inset_2px_0_#34d399]" : "border-transparent hover:border-border hover:bg-muted/50"}`}>
            <span className={`size-1.5 shrink-0 ${item.runtimeError ? "bg-destructive" : "bg-emerald-500"}`} /><span className="min-w-0 flex-1"><span className="block truncate font-mono text-[10px] font-medium">{item.id}</span><span className="block truncate font-mono text-[8px] text-muted-foreground">{item.instanceId}</span></span><ChevronRight className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </button>)}</div>
        </section>; })}
      </nav>
      <div className="border-t p-4">
        <div className="grid grid-cols-2 gap-px border bg-border"><SidebarMetric label="Components" value={String(components.length).padStart(2, "0")} /><SidebarMetric label="Kinds" value={String(kinds).padStart(2, "0")} /></div>
        {runtime.data ? <><p className="mt-4 text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Registry</p><code className="mt-1 block truncate text-[9px] text-foreground/70" title={runtime.data.registry}>{runtime.data.registry}</code></> : null}
      </div>
    </aside>
    <section className="agentos-content min-w-0">
      <header className="agentos-topbar sticky top-0 z-40 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-xl md:px-6">
        <button type="button" onClick={toggleSidebar} className="grid size-9 shrink-0 place-items-center border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label={(isDesktop ? desktopSidebarOpen : mobileSidebarOpen) ? "Close sidebar" : "Open sidebar"} aria-controls="agentos-navigation" aria-expanded={isDesktop ? desktopSidebarOpen : mobileSidebarOpen} title="Toggle sidebar (⌘/Ctrl+B)">{(isDesktop ? desktopSidebarOpen : mobileSidebarOpen) ? <PanelLeftClose className="size-3.5" /> : <PanelLeftOpen className="size-3.5" />}</button>
        <RuntimeBreadcrumb view={view} selected={selected} />
        <button type="button" onClick={() => setCommandOpen(true)} className="ml-auto hidden h-8 min-w-48 items-center gap-2 border bg-muted/40 px-2 text-left text-[9px] text-muted-foreground lg:flex"><Command className="size-3" /><span>Search runtime</span><kbd className="ml-auto border px-1.5 py-0.5 font-mono text-[8px]">⌘K</kbd></button>
        <span className="hidden items-center gap-2 border px-2 py-1 text-[8px] uppercase tracking-[0.12em] text-muted-foreground sm:flex"><span className={`size-1.5 ${runtime.isSuccess ? "bg-emerald-500" : "bg-destructive"}`} />{runtime.isSuccess ? "Runtime online" : "Connecting"}</span>
        <button type="button" className="grid size-9 place-items-center border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => void Promise.all([queryClient.invalidateQueries({ queryKey: ["runtime"] }), queryClient.invalidateQueries({ queryKey: ["store"] }), queryClient.invalidateQueries({ queryKey: ["settings"] })])} aria-label="Refresh"><RefreshCw className={`size-3.5 ${runtime.isFetching ? "animate-spin" : ""}`} /></button>
        <button type="button" className="grid size-9 place-items-center border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => setDark((value) => !value)} aria-label="Toggle theme">{dark ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}</button>
      </header>
      <main className="min-w-0">{runtime.isError ? <ErrorPanel title="Runtime API unavailable" error={runtime.error} /> : runtime.isLoading ? <LoadingPanel label="Loading runtime graph…" /> : view === "store" ? <StoreView registry={runtime.data?.registry ?? ""} /> : view === "settings" ? <SettingsView /> : !selected ? <EmptyRuntime onOpenStore={() => navigateToView("store")} /> : <>
        <div className="flex flex-col gap-3 border-b bg-muted/20 px-5 py-3 sm:flex-row sm:items-center sm:justify-between md:px-8"><div className="flex min-w-0 items-center gap-3"><span className={`size-2 ${selected.runtimeError ? "bg-destructive" : "bg-emerald-500"}`} /><div className="min-w-0"><p className="text-[8px] uppercase tracking-[0.16em] text-muted-foreground">Mounted capability</p><p className="mt-1 truncate font-mono text-[11px]">{selected.packageName}@{selected.version}</p></div></div><label className="flex items-center gap-3 font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">SWAP<select value={selected.instanceId} onChange={(event) => navigateToComponent(event.target.value)} className="h-8 max-w-72 border bg-background px-2 font-mono text-[10px] normal-case tracking-normal text-foreground outline-none focus:border-emerald-500/50">{components.map((item) => <option key={item.instanceId} value={item.instanceId}>{item.kind} / {item.instanceId}</option>)}</select></label></div>
        <SurfaceBoundary key={selected.instanceId}><DynamicSurface component={selected} /></SurfaceBoundary>
      </>}</main>
      <footer className="agentos-statusbar hidden h-6 items-center gap-4 border-t px-3 font-mono text-[8px] uppercase tracking-[.08em] text-muted-foreground lg:flex"><span className="flex items-center gap-1.5 text-emerald-500"><GitBranch className="size-3" />main</span><span>{components.length} mounted</span><span>{kinds} interface kinds</span><span className="ml-auto max-w-80 truncate">{runtime.data?.registry}</span><span>AgentOS v2</span></footer>
    </section>
    {commandOpen ? <div className="fixed inset-0 z-[100] flex justify-center bg-black/65 px-4 pt-[12svh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setCommandOpen(false); }}><div className="h-fit w-full max-w-2xl border bg-background shadow-2xl"><label className="flex h-12 items-center gap-3 border-b px-3"><Search className="size-4 text-emerald-500" /><input autoFocus value={commandQuery} onChange={(event) => setCommandQuery(event.target.value)} placeholder="Search components, packages, and interfaces…" className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none" /><kbd className="border px-1.5 py-1 font-mono text-[8px] text-muted-foreground">ESC</kbd></label><div className="max-h-[55svh] overflow-y-auto p-2"><button type="button" onClick={() => { navigateToView("store"); setCommandOpen(false); }} className="flex w-full items-center gap-3 border border-transparent px-3 py-2.5 text-left hover:border-border hover:bg-muted"><ShoppingBag className="size-3.5 text-muted-foreground" /><span className="font-mono text-[10px]">registry / packages</span><span className="ml-auto text-[8px] uppercase tracking-[.1em] text-muted-foreground">Store</span></button><button type="button" onClick={() => { navigateToView("settings"); setCommandOpen(false); }} className="flex w-full items-center gap-3 border border-transparent px-3 py-2.5 text-left hover:border-border hover:bg-muted"><Settings className="size-3.5 text-muted-foreground" /><span className="font-mono text-[10px]">system / settings</span><span className="ml-auto text-[8px] uppercase tracking-[.1em] text-muted-foreground">Settings</span></button>{commandMatches.map((item) => <button key={item.instanceId} type="button" onClick={() => navigateToComponent(item.instanceId)} className="flex w-full items-center gap-3 border border-transparent px-3 py-2.5 text-left hover:border-emerald-500/25 hover:bg-emerald-500/[.06]"><span className={`size-1.5 ${item.runtimeError ? "bg-destructive" : "bg-emerald-500"}`} /><span className="min-w-0"><span className="block truncate font-mono text-[10px]">{item.instanceId}</span><span className="block truncate font-mono text-[8px] text-muted-foreground">{item.packageName}@{item.version}</span></span><span className="ml-auto text-[8px] uppercase tracking-[.1em] text-muted-foreground">{item.kind}</span></button>)}</div></div></div> : null}
  </div>;
}

function RuntimeBreadcrumb({ view, selected }: { view: View; selected?: RuntimeComponentDto }) {
  const trail = view === "store"
    ? [
        { label: "agentos", href: "#components" },
        { label: "registry", href: "#store" },
        { label: "packages" },
      ]
    : view === "settings"
      ? [
          { label: "agentos", href: "#components" },
          { label: "system", href: "#settings" },
          { label: "settings" },
        ]
    : [
        { label: "agentos", href: "#components" },
        { label: selected?.kind ?? "runtime", href: "#components" },
        { label: selected?.instanceId ?? "components" },
      ];
  return (
    <Breadcrumb className="min-w-0">
      <BreadcrumbList className="gap-1 font-mono text-[10px] sm:gap-1.5">
        {trail.flatMap((item, index) => {
          const last = index === trail.length - 1;
          return [
            index > 0 ? <BreadcrumbSeparator key={`sep-${item.label}`} className="hidden sm:inline-flex [&>svg]:size-3" /> : null,
            <BreadcrumbItem key={item.label} className={last ? "min-w-0" : "hidden sm:inline-flex"}>
              {last || !item.href
                ? <BreadcrumbPage className="truncate">{item.label}</BreadcrumbPage>
                : <BreadcrumbLink href={item.href}>{item.label}</BreadcrumbLink>}
            </BreadcrumbItem>,
          ];
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}

function SettingsView() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => requestJson<HostSettingsDto>("/api/settings") });
  const [registry, setRegistry] = useState("");
  const [version, setVersion] = useState("");
  const [restarting, setRestarting] = useState(false);
  useEffect(() => {
    if (!settings.data) return;
    setRegistry(settings.data.registry);
    setVersion(settings.data.host.latest ?? settings.data.host.current);
  }, [settings.data]);
  const saveRegistry = useMutation({
    mutationFn: () => requestJson<HostSettingsDto>("/api/settings", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ registry }) }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["settings"] }),
        queryClient.invalidateQueries({ queryKey: ["runtime"] }),
        queryClient.invalidateQueries({ queryKey: ["store"] }),
      ]);
    },
  });
  const updateHost = useMutation({
    mutationFn: () => requestJson<HostUpdateResult>("/api/settings/update", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ version }) }),
    onSuccess: async () => {
      setRestarting(true);
      await waitForControlPlane();
      location.reload();
    },
  });
  if (settings.isLoading) return <LoadingPanel label="Loading host settings…" />;
  if (settings.isError || !settings.data) return <ErrorPanel title="Settings unavailable" error={settings.error} />;
  const data = settings.data;
  return <div className="p-5 md:p-8 xl:p-10">
    <div className="max-w-3xl border-b pb-8"><p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Control plane</p><h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight md:text-4xl">Host settings.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Inspect the running shell, point it at a registry, and install a specific <code className="font-mono text-xs">agentos</code> version without SSH.</p></div>
    {saveRegistry.isError || updateHost.isError ? <div className="mt-5 border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">{(saveRegistry.error ?? updateHost.error)?.message}</div> : null}
    {restarting || updateHost.isPending ? <div className="mt-5 border border-emerald-500/25 bg-emerald-500/[.06] p-4 text-xs text-emerald-500">{restarting ? "Restarting control plane…" : "Installing host package…"}</div> : null}
    <section className="mt-8 border bg-card p-5">
      <p className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Host package</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <SidebarMetric label="Installed" value={data.host.current} />
        <SidebarMetric label="Registry latest" value={data.host.latest ?? "—"} />
        <SidebarMetric label="Status" value={data.host.updateAvailable ? "UPDATE" : "CURRENT"} />
      </div>
      <form className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); updateHost.mutate(); }}>
        <label className="block min-w-0 flex-1"><span className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Install version</span><input value={version} onChange={(event) => setVersion(event.target.value)} placeholder="0.7.2" className="mt-2 h-10 w-full border bg-background px-3 font-mono text-sm outline-none" /></label>
        <button disabled={updateHost.isPending || restarting || !version} type="submit" className="inline-flex h-10 items-center justify-center gap-2 bg-primary px-4 font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-primary-foreground disabled:opacity-50"><Download className="size-3.5" />{data.host.updateAvailable ? `Update to ${version}` : "Install version"}</button>
      </form>
    </section>
    <section className="mt-5 border bg-card p-5">
      <p className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Package registry</p>
      <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); saveRegistry.mutate(); }}>
        <label className="block min-w-0 flex-1"><span className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Registry URL</span><input value={registry} onChange={(event) => setRegistry(event.target.value)} className="mt-2 h-10 w-full border bg-background px-3 font-mono text-sm outline-none" /></label>
        <button disabled={saveRegistry.isPending || registry === data.registry} type="submit" className="inline-flex h-10 items-center justify-center border px-4 font-mono text-[9px] uppercase tracking-[0.08em] disabled:opacity-50">Save</button>
      </form>
      <p className="mt-4 truncate font-mono text-[10px] text-muted-foreground" title={data.configPath}>{data.configPath}</p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">{data.server.host}:{data.server.port}</p>
    </section>
    <section className="mt-5 border bg-card p-5">
      <p className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">Resolved runtime</p>
      <div className="mt-4 space-y-2">{data.runtimePackages.map((item) => <div key={item.name} className="flex items-center justify-between gap-4 border px-3 py-2.5"><span className="truncate font-mono text-xs">{item.name}</span><span className="font-mono text-[10px] text-muted-foreground">v{item.current}</span></div>)}</div>
    </section>
  </div>;
}

async function waitForControlPlane(): Promise<void> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      const response = await fetch("/api/health");
      if (response.ok) return;
    } catch {
      /* process is restarting */
    }
  }
}

function StoreView({ registry }: { registry: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [restarting, setRestarting] = useState(false);
  const store = useQuery({ queryKey: ["store"], queryFn: () => requestJson<StorePackageDto[]>("/api/store") });
  const mutation = useMutation({
    mutationFn: ({ action, packageName, version }: { action: "install" | "update" | "uninstall"; packageName: string; version?: string }) => requestJson<StoreMutationResult>(`/api/store/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ packageName, version }) }),
    onSuccess: async (result) => {
      if (result.restarting) {
        setRestarting(true);
        await waitForControlPlane();
        location.reload();
        return;
      }
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["runtime"] }), queryClient.invalidateQueries({ queryKey: ["store"] }), queryClient.invalidateQueries({ queryKey: ["component-data"] })]);
    },
  });
  const packages = (store.data ?? []).filter((item) => `${item.name} ${item.description ?? ""} ${item.keywords.join(" ")}`.toLowerCase().includes(search.toLowerCase()));
  const installed = store.data?.filter((item) => item.installed).length ?? 0;
  return <div className="p-5 md:p-8 xl:p-10">
    <div className="flex flex-col gap-6 border-b pb-8 xl:flex-row xl:items-end xl:justify-between"><div className="max-w-2xl"><p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">Registry catalog</p><h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight md:text-4xl">Build your runtime.</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Install versioned capabilities and let AgentOS discover their runtime contracts, settings, and management surfaces automatically.</p></div><div className="grid min-w-64 grid-cols-2 gap-px border bg-border"><SidebarMetric label="Available" value={String(store.data?.length ?? 0).padStart(2, "0")} /><SidebarMetric label="Installed" value={String(installed).padStart(2, "0")} /></div></div>
    <div className="mt-7 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-center"><label className="flex h-10 w-full max-w-xl items-center gap-3 border bg-background px-3"><Search className="size-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search capabilities, packages, keywords…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" /></label><code className="truncate text-[10px] text-muted-foreground sm:ml-auto" title={registry}>{registry}</code></div>
    {mutation.isError ? <div className="mt-5 border border-destructive/30 bg-destructive/5 p-4 text-xs text-destructive">{mutation.error.message}</div> : null}
    {restarting ? <div className="mt-5 border border-emerald-500/25 bg-emerald-500/[.06] p-4 text-xs text-emerald-500">Update installed. Restarting control plane and message runtime…</div> : null}
    {store.isLoading ? <LoadingPanel label="Reading registry catalog…" /> : store.isError ? <ErrorPanel title="Store unavailable" error={store.error} /> : packages.length === 0 ? <div className="grid min-h-64 place-items-center border border-dashed text-sm text-muted-foreground">No matching capabilities.</div> : <div className="mt-6 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">{packages.map((item) => <StoreCard key={item.name} item={item} busy={mutation.isPending && mutation.variables.packageName === item.name} onInstall={() => mutation.mutate({ action: "install", packageName: item.name, version: item.version })} onUpdate={() => mutation.mutate({ action: "update", packageName: item.name, version: item.version })} onUninstall={() => { if (window.confirm(`Uninstall ${item.name} and remove its component configuration?`)) mutation.mutate({ action: "uninstall", packageName: item.name }); }} />)}</div>}
  </div>;
}

function StoreCard({ item, busy, onInstall, onUpdate, onUninstall }: { item: StorePackageDto; busy: boolean; onInstall(): void; onUpdate(): void; onUninstall(): void }) {
  const keywords = item.keywords.filter((keyword) => keyword !== "agent-os" && keyword !== "capability").slice(0, 4);
  return <article className="flex min-h-64 flex-col border bg-card p-5 transition-colors hover:border-foreground/20 hover:bg-muted/20"><div className="flex items-start justify-between gap-4"><div className={`grid size-10 place-items-center border ${item.installed ? "border-emerald-500/25 bg-emerald-500/[.07] text-emerald-500" : "bg-muted"}`}>{item.installed ? <PackageCheck className="size-4" /> : <Boxes className="size-4" />}</div><span className={`border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${item.updateAvailable ? "border-amber-500/35 text-amber-500" : item.installed ? "border-emerald-500/30 text-emerald-500" : "text-muted-foreground"}`}>{item.updateAvailable ? "Update available" : item.installed ? `${item.instances} active` : "Available"}</span></div><h2 className="mt-5 break-all font-mono text-sm font-semibold">{item.name}</h2><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description ?? "AgentOS capability package"}</p><div className="mt-4 flex flex-wrap gap-1.5">{keywords.map((keyword) => <span key={keyword} className="border px-2 py-1 text-[9px] text-muted-foreground">{keyword}</span>)}</div><div className="mt-auto flex flex-col gap-4 border-t pt-5"><div className="flex items-end justify-between gap-4"><div><p className="text-[8px] uppercase tracking-[0.14em] text-muted-foreground">{item.installed ? "Installed / latest" : "Latest version"}</p><p className="mt-1 font-mono text-xs">{item.installed ? `v${item.installedVersion ?? "?"} → v${item.version}` : `v${item.version}`}</p></div><div className="flex gap-2">{item.updateAvailable ? <button disabled={busy} type="button" onClick={onUpdate} className="inline-flex h-9 items-center justify-center gap-2 border bg-primary px-3 font-mono text-[9px] font-medium uppercase tracking-[0.08em] text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50">{busy ? <RefreshCw className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}{busy ? "Updating" : "Update"}</button> : null}<button disabled={busy} type="button" onClick={item.installed ? onUninstall : onInstall} aria-label={item.installed ? `Uninstall ${item.name}` : `Install ${item.name}`} className={`inline-flex h-9 items-center justify-center gap-2 border px-3 font-mono text-[9px] font-medium uppercase tracking-[0.08em] transition-colors disabled:opacity-50 ${item.installed ? "border-destructive/35 text-destructive hover:bg-destructive/10" : "bg-primary text-primary-foreground hover:bg-primary/85"}`}>{busy && !item.updateAvailable ? <RefreshCw className="size-3.5 animate-spin" /> : item.installed ? <Trash2 className="size-3.5" /> : <Download className="size-3.5" />}{busy && !item.updateAvailable ? "Working" : item.installed && item.updateAvailable ? null : item.installed ? "Uninstall" : "Install"}</button></div></div></div></article>;
}

function NavButton({ active, icon: Icon, label, meta, onClick }: { active: boolean; icon: typeof Layers3; label: string; meta: string; onClick(): void }) { return <button type="button" onClick={onClick} className={`flex min-h-11 w-full items-center gap-3 border px-3 py-2.5 text-left transition-colors ${active ? "border-foreground/25 bg-muted" : "border-transparent hover:border-border hover:bg-muted/40"}`}><Icon className="size-4" /><span className="text-xs font-medium">{label}</span><span className="ml-auto text-[8px] uppercase tracking-[0.12em] text-muted-foreground">{meta}</span></button>; }

function DynamicSurface({ component }: { component: RuntimeComponentDto }) {
  const queryClient = useQueryClient();
  const [reloading, setReloading] = useState(false);
  const [reloadError, setReloadError] = useState("");
  const dataQuery = useQuery({ queryKey: ["component-data", component.instanceId], queryFn: async () => hydrateBridge(await requestJson<unknown>(`/api/components/${encodeURIComponent(component.instanceId)}/data`), component.instanceId, async () => { await queryClient.invalidateQueries({ queryKey: ["component-data", component.instanceId] }); }), enabled: component.hasDataBridge });
  useComponentStyles(component.web?.styleUrl);
  const Microfrontend = useMemo(() => { if (!component.web) return CapabilityMicrofrontend as MicrofrontendComponent; return lazy(async () => { const module = await import(/* @vite-ignore */ component.web!.moduleUrl) as Record<string, unknown>; const exported = module[component.web!.exportName] ?? module.default; if (typeof exported !== "function") throw new Error(`Microfrontend export ${component.web!.exportName} was not found`); return { default: exported as MicrofrontendComponent }; }); }, [component.web]);
  const componentInstance = { instanceId: component.instanceId, kind: component.kind, id: component.id, packageId: component.packageId, version: component.version, config: component.config };
  async function reloadRuntime() { setReloading(true); setReloadError(""); try { await requestJson<RuntimeSnapshot>("/api/runtime/reload", { method: "POST" }); await Promise.all([queryClient.invalidateQueries({ queryKey: ["runtime"] }), queryClient.invalidateQueries({ queryKey: ["component-data"] })]); } catch (error) { setReloadError(error instanceof Error ? error.message : String(error)); } finally { setReloading(false); } }
  return <>{component.runtimeError ? <div className="mx-5 mt-5 flex flex-col gap-4 border border-destructive/30 bg-destructive/5 p-4 md:mx-8 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-medium text-destructive">Runtime is waiting for configuration</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{reloadError || component.runtimeError}</p></div><button type="button" disabled={reloading} onClick={() => void reloadRuntime()} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 border bg-background px-3 font-mono text-[9px] font-medium uppercase tracking-[0.08em] hover:bg-muted disabled:opacity-50"><RefreshCw className={`size-3.5 ${reloading ? "animate-spin" : ""}`} />{reloading ? "Reloading" : "Retry runtime"}</button></div> : null}<Suspense fallback={<LoadingPanel label="Loading package microfrontend…" />}><Microfrontend component={componentInstance} data={dataQuery.data} onSaveConfig={async (config) => { await requestJson("/api/configuration", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ instanceId: component.instanceId, config }) }); await Promise.all([queryClient.invalidateQueries({ queryKey: ["runtime"] }), queryClient.invalidateQueries({ queryKey: ["component-data", component.instanceId] })]); }} /></Suspense></>;
}

function useComponentStyles(styleUrl?: string) { useEffect(() => { if (!styleUrl) return; const link = document.createElement("link"); link.rel = "stylesheet"; link.href = styleUrl; link.dataset.agentOsCapabilityStyle = "true"; document.head.append(link); return () => link.remove(); }, [styleUrl]); }
function hydrateBridge(value: unknown, instanceId: string, afterAction: () => void | Promise<void>): unknown { if (Array.isArray(value)) return value.map((item) => hydrateBridge(item, instanceId, afterAction)); if (!value || typeof value !== "object") return value; if ("__agentOsAction" in value && typeof (value as BridgeActionMarker).__agentOsAction === "string") { const path = (value as BridgeActionMarker).__agentOsAction; return async (...args: unknown[]) => { const result = await requestJson(`/api/components/${encodeURIComponent(instanceId)}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ path, args }) }); await afterAction(); return result; }; } return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, hydrateBridge(item, instanceId, afterAction)])); }
function groupComponents(components: RuntimeComponentDto[]) { const groups = new Map<RuntimeComponentDto["kind"], RuntimeComponentDto[]>(); for (const item of components) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]); return [...groups.entries()]; }
function SidebarMetric({ label, value }: { label: string; value: string }) { return <div className="bg-background p-3"><p className="font-mono text-xl">{value}</p><p className="mt-1 text-[8px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p></div>; }
function LoadingPanel({ label }: { label: string }) { return <div className="grid min-h-[55svh] place-items-center p-8 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>; }
function ErrorPanel({ title, error }: { title: string; error: unknown }) { return <div className="m-5 border border-destructive/30 bg-destructive/5 p-5 md:m-8"><p className="font-medium text-destructive">{title}</p><p className="mt-2 text-xs text-muted-foreground">{error instanceof Error ? error.message : String(error)}</p></div>; }
function EmptyRuntime({ onOpenStore }: { onOpenStore(): void }) { return <div className="grid min-h-[70svh] place-items-center p-8 text-center"><div><Boxes className="mx-auto size-7 text-muted-foreground" /><h1 className="mt-4 text-xl font-semibold">No components installed</h1><p className="mt-2 text-sm text-muted-foreground">Choose a capability from your registry to assemble this runtime.</p><button type="button" onClick={onOpenStore} className="mt-5 inline-flex h-9 items-center gap-2 bg-primary px-4 text-xs text-primary-foreground"><ShoppingBag className="size-3.5" />Open Store</button></div></div>; }
class SurfaceBoundary extends Component<{ children: ReactNode }, { error?: Error }> { state: { error?: Error } = {}; static getDerivedStateFromError(error: Error) { return { error }; } componentDidCatch(error: Error, info: ErrorInfo) { console.error(error, info); } render() { return this.state.error ? <ErrorPanel title="Microfrontend failed to load" error={this.state.error} /> : this.props.children; } }
async function requestJson<T = unknown>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, init); const body = await response.json() as T & { error?: string }; if (!response.ok) throw new Error(body.error ?? `Request failed (${response.status})`); return body; }
