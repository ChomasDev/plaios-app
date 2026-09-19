import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

import type { DynamicAppConfig, DynamicComponentConfig } from "./types.js";

export const DEFAULT_CONFIG_FILE = "agent-os.yaml";
export const DEFAULT_REGISTRY = "http://localhost:4873";

export function parseDynamicAppConfig(source: string): DynamicAppConfig {
  const value: unknown = parseYaml(source);
  if (!isRecord(value)) throw new Error("Agent OS config must be a YAML object");
  if (value.schemaVersion !== 1) throw new Error('Agent OS config "schemaVersion" must be 1');
  const registry = requiredUrl(value.registry, "registry");
  const serverValue = value.server === undefined ? {} : value.server;
  if (!isRecord(serverValue)) throw new Error('Agent OS config "server" must be an object');
  const host = optionalText(serverValue.host, "server.host") ?? "0.0.0.0";
  const port = optionalPort(serverValue.port) ?? 3100;
  if (!Array.isArray(value.components)) {
    throw new Error('Agent OS config "components" must be an array');
  }
  const components = value.components.map(parseComponent);
  const instanceIds = new Set<string>();
  for (const [index, component] of components.entries()) {
    const instanceId = component.instanceId ?? `${component.interface}:${index + 1}`;
    component.instanceId = instanceId;
    if (instanceIds.has(instanceId)) throw new Error(`Duplicate component instanceId: ${instanceId}`);
    instanceIds.add(instanceId);
  }
  return { schemaVersion: 1, registry, server: { host, port }, components };
}

export function serializeDynamicAppConfig(config: DynamicAppConfig): string {
  return stringifyYaml({
    ...config,
    components: config.components.map((component) => {
      const next = { ...component };
      if (next.enabled !== false) delete next.enabled;
      return next;
    }),
  }, { lineWidth: 100 });
}

export async function loadOrCreateConfig(path: string): Promise<{ config: DynamicAppConfig; created: boolean }> {
  try {
    await access(path);
    return { config: parseDynamicAppConfig(await readFile(path, "utf8")), created: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const config = starterConfig();
  await writeDynamicAppConfig(path, config);
  return { config, created: true };
}

export async function writeDynamicAppConfig(path: string, config: DynamicAppConfig): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, serializeDynamicAppConfig(config), "utf8");
}

export function starterConfig(): DynamicAppConfig {
  return {
    schemaVersion: 1,
    registry: process.env.AGENT_OS_REGISTRY ?? DEFAULT_REGISTRY,
    server: { host: "0.0.0.0", port: 3100 },
    components: [
      {
        package: "@agent-os/sqlite",
        version: "latest",
        interface: "sqlite.database",
        instanceId: "database:main",
        config: { databasePath: ".agent-os/data/agent-os.sqlite" },
      },
      {
        package: "@agent-os/telegram",
        version: "latest",
        interface: "telegram.input",
        instanceId: "input:telegram",
        config: {},
      },
      {
        package: "@agent-os/telegram",
        version: "latest",
        interface: "telegram.output",
        instanceId: "output:telegram",
        config: {},
      },
    ],
  };
}

export function resolveConfigPath(currentDirectory: string, path?: string): string {
  return resolve(currentDirectory, path ?? process.env.AGENT_OS_CONFIG ?? DEFAULT_CONFIG_FILE);
}

function parseComponent(value: unknown, index: number): DynamicComponentConfig {
  if (!isRecord(value)) throw new Error(`components[${index}] must be an object`);
  const packageName = requiredText(value.package, `components[${index}].package`);
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/i.test(packageName)) {
    throw new Error(`Invalid npm package name: ${packageName}`);
  }
  const config = value.config;
  if (config !== undefined && !isRecord(config)) {
    throw new Error(`components[${index}].config must be an object`);
  }
  return {
    package: packageName,
    version: optionalText(value.version, `components[${index}].version`),
    interface: requiredText(value.interface, `components[${index}].interface`),
    instanceId: optionalText(value.instanceId, `components[${index}].instanceId`),
    enabled: optionalBoolean(value.enabled, `components[${index}].enabled`),
    config,
  };
}

function requiredUrl(value: unknown, path: string): string {
  const text = requiredText(value, path);
  const url = new URL(text);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${path} must use http or https`);
  }
  return url.href.replace(/\/$/, "");
}

function optionalPort(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error("server.port must be an integer between 1 and 65535");
  }
  return value;
}

function requiredText(value: unknown, path: string): string {
  const text = optionalText(value, path);
  if (!text) throw new Error(`${path} must be a non-empty string`);
  return text;
}

function optionalText(value: unknown, path: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${path} must be a non-empty string`);
  }
  return value.trim();
}

function optionalBoolean(value: unknown, path: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw new Error(`${path} must be a boolean`);
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
