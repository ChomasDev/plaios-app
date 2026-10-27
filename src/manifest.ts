import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import type {
  DynamicManifestInterface,
  DynamicPackageManifest,
  ManifestWebSurface,
} from "./types.js";
import { INTERFACE_KINDS, isRecord } from "./types.js";

const KINDS = new Set<string>(INTERFACE_KINDS);

export async function loadPackageManifest(packageRoot: string): Promise<DynamicPackageManifest> {
  return parsePackageManifest(await readFile(join(packageRoot, "agent-os.package.yaml"), "utf8"));
}

export function parsePackageManifest(source: string): DynamicPackageManifest {
  const value: unknown = parseYaml(source);
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("Package manifest must be a schemaVersion 1 YAML object");
  }
  if (!Array.isArray(value.interfaces) || value.interfaces.length === 0) {
    throw new Error("Package manifest must declare at least one interface");
  }
  return {
    schemaVersion: 1,
    id: text(value.id, "id"),
    name: text(value.name, "name"),
    version: text(value.version, "version"),
    description: optionalText(value.description, "description"),
    interfaces: value.interfaces.map(parseInterface),
  };
}

function parseInterface(value: unknown, index: number): DynamicManifestInterface {
  if (!isRecord(value)) throw new Error(`interfaces[${index}] must be an object`);
  const kind = systemKind(text(value.kind, `interfaces[${index}].kind`));
  if (!KINDS.has(kind)) throw new Error(`Invalid interface kind: ${kind}`);
  return {
    id: text(value.id, `interfaces[${index}].id`),
    kind: kind as DynamicManifestInterface["kind"],
    name: optionalText(value.name, `interfaces[${index}].name`) ?? text(value.id, `interfaces[${index}].id`),
    entry: optionalText(value.entry, `interfaces[${index}].entry`) ?? ".",
    export: optionalText(value.export, `interfaces[${index}].export`) ?? ".",
    className: optionalText(value.className, `interfaces[${index}].className`),
    description: optionalText(value.description, `interfaces[${index}].description`),
    web: parseWeb(value.web, index, kind),
    config: Array.isArray(value.config) ? value.config.filter(isRecord) : undefined,
    required: kinds(value.required),
    optional: kinds(value.optional),
    startup: parseStartup(value.startup, index),
  };
}

// Packages published before System 1/2 declare the generative model as `ai`.
function systemKind(kind: string): string {
  return kind === "ai" ? "system2" : kind;
}

function kinds(value: unknown): string[] | undefined {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string").map(systemKind) : undefined;
}

function parseStartup(value: unknown, index: number): DynamicManifestInterface["startup"] {
  if (value === undefined) return undefined;
  if (!isRecord(value) || !["always", "ifConfigured", "manual"].includes(String(value.when))) {
    throw new Error(`interfaces[${index}].startup.when must be always, ifConfigured, or manual`);
  }
  return { when: value.when as "always" | "ifConfigured" | "manual" };
}

/** Every interface has a page microfrontend; without `web:` it is expected at the conventional `./web/<kind>` export. */
function parseWeb(value: unknown, index: number, kind: string): ManifestWebSurface {
  if (value === undefined) return { entry: `./web/${kind}`, export: "default", styles: "./web/styles.css", conventional: true };
  if (!isRecord(value)) throw new Error(`interfaces[${index}].web must be an object`);
  return {
    entry: text(value.entry, `interfaces[${index}].web.entry`),
    export: optionalText(value.export, `interfaces[${index}].web.export`) ?? "default",
    styles: optionalText(value.styles, `interfaces[${index}].web.styles`),
  };
}

function text(value: unknown, path: string): string {
  const result = optionalText(value, path);
  if (!result) throw new Error(`${path} must be a non-empty string`);
  return result;
}

function optionalText(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") throw new Error(`${path} must be a non-empty string`);
  return value.trim();
}
