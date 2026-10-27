import { CapabilityMicrofrontend, type MicrofrontendComponent } from "@agent-os/microfrontend";
import { useQueryClient } from "@tanstack/react-query";
import { Suspense, lazy, useMemo } from "react";

import { postJson } from "../../shared/api.js";
import type { RuntimeComponentDto } from "../../shared/types.js";
import { ChatCard } from "./chat-card.js";
import { toInstance } from "./instance.js";
import { SurfaceBoundary } from "./surface-boundary.js";
import { componentDataKey, useComponentData } from "./use-component-data.js";
import { useComponentStyles } from "./use-component-styles.js";

type Variant = "page" | "chat";

/**
 * Renders a package's own microfrontend with its data bridge, config saving and an error boundary.
 * The "chat" variant uses the module's `Chat` export, a compact card for answers; packages without one render nothing.
 */
export function Surface({ component, variant = "page" }: { component: RuntimeComponentDto; variant?: Variant }) {
  return <SurfaceBoundary key={component.instanceId}><DynamicSurface component={component} variant={variant} /></SurfaceBoundary>;
}

function DynamicSurface({ component, variant }: { component: RuntimeComponentDto; variant: Variant }) {
  const queryClient = useQueryClient();
  const data = useComponentData(component);
  useComponentStyles(component.web?.styleUrl);
  // Only a new web module (or variant) needs a new lazy component; the closure's id/instanceId never change with it.
  const Microfrontend = useMemo(() => loadMicrofrontend(component, variant), [component.web, variant]);
  const onSaveConfig = async (config: Record<string, unknown>) => {
    await postJson("/api/configuration", { instanceId: component.instanceId, config }, "PUT");
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["runtime"] }),
      queryClient.invalidateQueries({ queryKey: componentDataKey(component.instanceId) }),
    ]);
  };
  return <Suspense fallback={variant === "page" ? <SurfaceSkeleton /> : null}>
    <Microfrontend component={toInstance(component)} data={data.data} onSaveConfig={onSaveConfig} />
  </Suspense>;
}

function loadMicrofrontend(component: RuntimeComponentDto, variant: Variant): MicrofrontendComponent {
  const web = component.web;
  if (!web) return variant === "chat" ? Nothing : CapabilityMicrofrontend as MicrofrontendComponent;
  return lazy(async () => {
    const module = await import(/* @vite-ignore */ web.moduleUrl) as Record<string, unknown>;
    if (variant === "chat") return { default: chatCard(component, module.Chat as MicrofrontendComponent | undefined) };
    const exported = module[web.exportName] ?? module.default;
    if (typeof exported !== "function") throw new Error(`Microfrontend export ${web.exportName} was not found`);
    return { default: exported as MicrofrontendComponent };
  });
}

function chatCard(component: RuntimeComponentDto, Chat?: MicrofrontendComponent): MicrofrontendComponent {
  if (!Chat) return Nothing;
  return (props) => <ChatCard component={component}><Chat {...props} /></ChatCard>;
}

function SurfaceSkeleton() {
  return <div className="space-y-3 p-6" aria-label="Loading">
    <div className="h-4 w-1/3 animate-pulse rounded-full bg-muted" />
    <div className="h-24 animate-pulse rounded-xl bg-muted/70" />
  </div>;
}

function Nothing() { return null; }
