import type { OpenUIComponentModule } from "@agent-os/microfrontend";
import { memo } from "react";

import { openComponent } from "../../../app/routes.js";
import type { RuntimeComponentDto } from "../../../shared/types.js";
import { toInstance } from "../../surface/instance.js";
import { useComponentData } from "../../surface/use-component-data.js";
import { useComponentStyles } from "../../surface/use-component-styles.js";

interface PluginComponentProps { component: RuntimeComponentDto; spec: OpenUIComponentModule; args: Record<string, unknown> }

// Every streamed token re-renders the answer; plugin components only re-render when their own arguments change.
export const PluginComponent = memo(function PluginComponent({ component, spec, args }: PluginComponentProps) {
  const data = useComponentData(component);
  const styled = useComponentStyles(component.web?.styleUrl);
  const Render = spec.component;
  if (!styled) return null;
  return <div className="my-2"><Render component={toInstance(component)} data={data.data} args={args} onOpen={openComponent} /></div>;
}, (previous, next) => previous.component.instanceId === next.component.instanceId && previous.spec === next.spec && JSON.stringify(previous.args) === JSON.stringify(next.args));
