import { useEffect, useState } from "react";

const loadedStyles = new Set<string>();

/** Loads a plugin's stylesheet once per page and reports when it has applied, so canvases measure a styled container. */
export function useComponentStyles(styleUrl?: string): boolean {
  const [ready, setReady] = useState(!styleUrl || loadedStyles.has(styleUrl));
  useEffect(() => {
    if (!styleUrl || loadedStyles.has(styleUrl)) return;
    const existing = document.head.querySelector<HTMLLinkElement>(`link[href="${styleUrl}"]`);
    const link = existing ?? Object.assign(document.createElement("link"), { rel: "stylesheet", href: styleUrl });
    const done = () => { loadedStyles.add(styleUrl); setReady(true); };
    link.addEventListener("load", done, { once: true });
    link.addEventListener("error", done, { once: true });
    if (!existing) document.head.append(link);
    return () => { link.removeEventListener("load", done); link.removeEventListener("error", done); };
  }, [styleUrl]);
  return ready;
}
