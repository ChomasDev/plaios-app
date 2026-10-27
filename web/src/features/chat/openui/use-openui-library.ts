import type { OpenUIComponentModule } from "@agent-os/microfrontend";
import { defineComponent } from "@openuidev/react-lang";
import { openuiLibrary } from "@openuidev/react-ui/genui-lib";
import { useQuery } from "@tanstack/react-query";
import { createElement } from "react";
import { z } from "zod";

import type { OpenUIPropSpec, RuntimeComponentDto } from "../../../shared/types.js";
import { PluginComponent } from "./plugin-component.js";

export type Library = typeof openuiLibrary;
type PluginDefinitions = NonNullable<NonNullable<Parameters<NonNullable<Library["extend"]>>[0]["components"]>["add"]>;

/** The stock OpenUI library extended with every `openui` component the installed plugins' web modules export. */
export function useOpenUILibrary(components: RuntimeComponentDto[]): Library {
  const withWeb = components.filter((item) => item.web && item.hasDataBridge && item.enabled !== false);
  const query = useQuery({
    queryKey: ["openui-library", withWeb.map((item) => `${item.instanceId}@${item.version}`)],
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => extend(firstByName((await Promise.all(withWeb.map(pluginComponents))).flat())),
  });
  return query.data ?? openuiLibrary;
}

async function pluginComponents(component: RuntimeComponentDto) {
  const module = await import(/* @vite-ignore */ component.web!.moduleUrl).catch(() => ({})) as { openui?: OpenUIComponentModule[] };
  return (module.openui ?? []).map((spec) => defineComponent({
    name: spec.name,
    description: spec.description,
    props: z.object(Object.fromEntries(spec.props.map((prop) => [prop.name, zodFor(prop)]))),
    component: ({ props }) => createElement(PluginComponent, { component, spec, args: props as Record<string, unknown> }),
  }));
}

/** Two instances of one package export the same components; extend() throws on duplicates, so the first one wins. */
function firstByName<T extends { name: string }>(definitions: T[]): T[] {
  return definitions.filter((definition, index) => definitions.findIndex((other) => other.name === definition.name) === index);
}

function zodFor(prop: OpenUIPropSpec) {
  const base = zodBase(prop.type);
  return prop.optional ? base.optional() : base;
}

function zodBase(type: OpenUIPropSpec["type"]) {
  if (type === "string[]") return z.array(z.string());
  if (type === "number") return z.number();
  if (type === "boolean") return z.boolean();
  return z.string();
}

// No slot hints: Stack and Card accept any component as children, and naming them makes extend() throw.
function extend(add: PluginDefinitions): Library {
  if (!add.length) return openuiLibrary;
  try {
    return openuiLibrary.extend!({ components: { add } }) as Library;
  } catch (error) {
    console.error("[openui] plugin components not added", error);
    return openuiLibrary;
  }
}
