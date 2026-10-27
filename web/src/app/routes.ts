import { useEffect, useState } from "react";

export type View = "history" | "chat" | "components" | "store" | "settings";
export type Pane = "history" | "chat" | "manage";
export interface Route { view: View; selectedId?: string; query?: string; packageName?: string }

const VIEWS: readonly View[] = ["history", "chat", "components", "store", "settings"];

export function parseHash(hash = location.hash): Route {
  const value = decodeURIComponent(hash.replace(/^#/, ""));
  if (value.startsWith("component/")) return { view: "components", selectedId: value.slice("component/".length).split("?")[0] };
  if (value.startsWith("package/")) return { view: "store", packageName: value.slice("package/".length) };
  if (value.startsWith("store/")) return { view: "store", query: value.slice("store/".length) };
  if (VIEWS.includes(value as View)) return { view: value as View };
  return { view: "chat" };
}

export function paneOf(view: View): Pane {
  if (view === "history" || view === "chat") return view;
  return "manage";
}

export function navigate(view: View): void {
  location.hash = view;
}

export function openComponent(instanceId: string): void {
  location.hash = `component/${encodeURIComponent(instanceId)}`;
}

export function packageHref(name: string): string {
  return `#package/${encodeURIComponent(name)}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash());
  useEffect(() => {
    const onHashChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return route;
}
