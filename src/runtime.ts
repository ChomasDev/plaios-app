import { readFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import type {
  AgentLoop,
  InputInterface,
  Memory,
  Orchestrator,
  OutputInterface,
} from "@agent-os/core";

import { AgentRuntime } from "./agent-runtime.js";
import { writeDynamicAppConfig } from "./config.js";
import { readHostSettings, type HostSettingsDto } from "./host-settings.js";
import {
  assertPackageName,
  installRuntimePackage,
  installedPackageRoot,
  uninstallRuntimePackage,
} from "./installer.js";
import { loadPackageManifest } from "./manifest.js";
import { buildRuntimeSlots, planKindReplacement, replaceKindComponents } from "./runtime-slots.js";
import { searchRegistry } from "./store-catalog.js";
import type {
  BridgeActionMarker,
  DynamicAppConfig,
  DynamicComponentConfig,
  DynamicManifestInterface,
  InterfaceKind,
  RuntimeComponentDto,
  RuntimeSnapshot,
} from "./types.js";
import { INTERFACE_KINDS, TOGGLE_KINDS } from "./types.js";

type RuntimeModule = Record<string, unknown>;
type Constructor = new (options?: Record<string, unknown>) => unknown;

interface LoadedComponent {
  definition: DynamicComponentConfig;
  descriptor: RuntimeComponentDto;
  manifestInterface: DynamicManifestInterface;
  instance?: unknown;
}

interface RegisteredAction {
  invoke: (...args: unknown[]) => unknown;
}

interface InstalledPackageJson {
  main?: string;
  exports?: unknown;
}

export class DynamicRuntime {
  private components: LoadedComponent[] = [];
  private readonly actions = new Map<string, Map<string, RegisteredAction>>();
  private agentRuntime?: AgentRuntime;

  constructor(
    readonly projectRoot: string,
    readonly runtimeRoot: string,
    readonly configPath: string,
    private config: DynamicAppConfig,
  ) {}

  async load(): Promise<void> {
    this.components = [];
    const definitions = await Promise.all(this.config.components.map(async (definition, index) => ({
      definition,
      index,
      kind: await this.interfaceKind(definition),
    })));
    definitions.sort((left, right) => kindPriority(left.kind) - kindPriority(right.kind) || left.index - right.index);
    for (const { definition } of definitions) {
      this.components.push(await this.loadComponent(definition));
    }
    const configOrder = new Map(this.config.components.map((definition, index) => [definition.instanceId, index]));
    this.components.sort((left, right) => (configOrder.get(left.definition.instanceId) ?? 0) - (configOrder.get(right.definition.instanceId) ?? 0));
    await this.registerActionCapabilities();
    this.startAgentRuntime();
  }

  async installPackage(packageName: string, version = "latest"): Promise<RuntimeSnapshot> {
    if (this.config.components.some((component) => component.package === packageName)) {
      throw new Error(`${packageName} is already installed`);
    }
    await installRuntimePackage(this.runtimeRoot, this.config.registry, packageName, version);
    const packageRoot = installedPackageRoot(this.runtimeRoot, packageName);
    const manifest = await loadPackageManifest(packageRoot);
    const existingIds = new Set(this.config.components.map(({ instanceId }) => instanceId));
    for (const manifestInterface of manifest.interfaces.filter(({ startup }) => startup?.when !== "manual")) {
      const baseId = `${manifestInterface.kind}:${manifest.id}`;
      let instanceId = baseId;
      let suffix = 2;
      while (existingIds.has(instanceId)) instanceId = `${baseId}:${suffix++}`;
      existingIds.add(instanceId);
      this.config.components.push({
        package: packageName,
        version: manifest.version,
        interface: manifestInterface.id,
        instanceId,
        config: manifestDefaults(manifestInterface),
      });
    }
    await writeDynamicAppConfig(this.configPath, this.config);
    await this.reload();
    return this.snapshot();
  }

  async uninstallPackage(packageName: string): Promise<RuntimeSnapshot> {
    const removed = this.config.components.filter((component) => component.package === packageName);
    if (removed.length === 0) throw new Error(`${packageName} is not installed`);
    await Promise.allSettled(
      this.components
        .filter(({ definition }) => definition.package === packageName)
        .map(({ instance }) => closeInstance(instance)),
    );
    this.config.components = this.config.components.filter((component) => component.package !== packageName);
    await writeDynamicAppConfig(this.configPath, this.config);
    await uninstallRuntimePackage(this.runtimeRoot, packageName);
    await this.reload();
    return this.snapshot();
  }

  async updatePackage(packageName: string, version = "latest"): Promise<RuntimeSnapshot> {
    const definitions = this.config.components.filter((component) => component.package === packageName);
    if (definitions.length === 0) throw new Error(`${packageName} is not installed`);

    await installRuntimePackage(this.runtimeRoot, this.config.registry, packageName, version);
    const packageRoot = installedPackageRoot(this.runtimeRoot, packageName);
    const manifest = await loadPackageManifest(packageRoot);
    const availableInterfaces = new Set(manifest.interfaces.map(({ id }) => id));
    const missingInterfaces = definitions
      .map(({ interface: interfaceId }) => interfaceId)
      .filter((interfaceId) => !availableInterfaces.has(interfaceId));
    if (missingInterfaces.length > 0) {
      throw new Error(
        `${packageName}@${manifest.version} no longer provides configured interface(s): ${missingInterfaces.join(", ")}`,
      );
    }

    for (const definition of definitions) definition.version = manifest.version;
    const existingIds = new Set(this.config.components.map(({ instanceId }) => instanceId));
    const configuredInterfaces = new Set(definitions.map(({ interface: interfaceId }) => interfaceId));
    for (const manifestInterface of manifest.interfaces.filter(
      ({ id, startup }) => !configuredInterfaces.has(id) && startup?.when !== "manual",
    )) {
      const baseId = `${manifestInterface.kind}:${manifest.id}`;
      let instanceId = baseId;
      let suffix = 2;
      while (existingIds.has(instanceId)) instanceId = `${baseId}:${suffix++}`;
      existingIds.add(instanceId);
      this.config.components.push({
        package: packageName,
        version: manifest.version,
        interface: manifestInterface.id,
        instanceId,
        config: manifestDefaults(manifestInterface),
      });
    }
    await writeDynamicAppConfig(this.configPath, this.config);
    await this.reload();
    return this.snapshot();
  }

  snapshot(): RuntimeSnapshot {
    return {
      configPath: this.configPath,
      registry: this.config.registry,
      components: this.components.map(({ descriptor }) => descriptor),
    };
  }

  async hostSettings(): Promise<HostSettingsDto> {
    const settings = await readHostSettings({
      projectRoot: this.projectRoot,
      configPath: this.configPath,
      registry: this.config.registry,
      server: this.config.server,
    });
    let catalog: Awaited<ReturnType<typeof searchRegistry>> = [];
    try {
      catalog = await searchRegistry(this.config.registry);
    } catch (error) {
      console.warn("[dynamic] Could not load registry slots:", error instanceof Error ? error.message : error);
    }
    return {
      ...settings,
      slots: buildRuntimeSlots(
        this.components.map(({ descriptor, definition }) => ({
          kind: descriptor.kind,
          instanceId: descriptor.instanceId,
          packageName: descriptor.packageName,
          version: descriptor.version,
          interfaceId: descriptor.id,
          config: definition.config,
          enabled: definition.enabled !== false,
        })),
        catalog,
      ),
    };
  }

  async swapKind(kind: InterfaceKind, packageName: string, version = "latest"): Promise<RuntimeSnapshot> {
    if (!INTERFACE_KINDS.includes(kind)) throw new Error(`Unknown interface kind: ${kind}`);
    assertPackageName(packageName);
    const existing = this.components.filter(({ descriptor }) => descriptor.kind === kind);
    const samePackage = existing.length > 0 && existing.every(({ definition }) => definition.package === packageName);
    const sameVersion = version === "latest" || existing.every(({ definition }) => definition.version === version);
    if (samePackage && sameVersion) return this.snapshot();
    await installRuntimePackage(this.runtimeRoot, this.config.registry, packageName, version);
    const manifest = await loadPackageManifest(installedPackageRoot(this.runtimeRoot, packageName));
    const interfaces = manifest.interfaces.filter((item) => item.kind === kind && item.startup?.when !== "manual");
    if (interfaces.length === 0) {
      throw new Error(`${packageName}@${manifest.version} does not provide a ${kind} interface`);
    }
    const replacements = planKindReplacement(
      existing.map(({ descriptor, definition }) => ({
        kind: descriptor.kind,
        instanceId: descriptor.instanceId,
        packageName: descriptor.packageName,
        version: descriptor.version,
        interfaceId: descriptor.id,
        enabled: definition.enabled,
        config: definition.config,
      })),
      interfaces,
      packageName,
      manifest.version,
    );
    const kindOf = new Map(this.components.map(({ definition, descriptor }) => [definition.instanceId ?? "", descriptor.kind]));
    const previousPackages = new Set(this.config.components.map((component) => component.package));
    this.config.components = replaceKindComponents(this.config.components, kindOf, kind, replacements);
    assignUniqueInstanceIds(this.config.components);
    await writeDynamicAppConfig(this.configPath, this.config);
    for (const previous of previousPackages) {
      if (!this.config.components.some((component) => component.package === previous)) {
        await uninstallRuntimePackage(this.runtimeRoot, previous).catch((error: unknown) => {
          console.warn(`[dynamic] Could not remove unused package ${previous}:`, error instanceof Error ? error.message : error);
        });
      }
    }
    await this.reload();
    return this.snapshot();
  }

  async setComponentEnabled(instanceId: string, enabled: boolean): Promise<RuntimeSnapshot> {
    const component = this.get(instanceId);
    if (!TOGGLE_KINDS.includes(component.descriptor.kind)) {
      throw new Error("Only input, output, and action instances can be enabled or disabled");
    }
    const definition = this.config.components.find((item) => item.instanceId === instanceId);
    if (!definition) throw new Error(`Unknown component instance: ${instanceId}`);
    definition.enabled = enabled;
    await writeDynamicAppConfig(this.configPath, this.config);
    await this.reload();
    return this.snapshot();
  }

  async removeComponent(instanceId: string): Promise<RuntimeSnapshot> {
    const component = this.get(instanceId);
    if (component.descriptor.kind !== "action") {
      throw new Error("Only action instances can be removed from settings");
    }
    const packageName = component.definition.package;
    await closeInstance(component.instance);
    this.config.components = this.config.components.filter((item) => item.instanceId !== instanceId);
    await writeDynamicAppConfig(this.configPath, this.config);
    if (!this.config.components.some((item) => item.package === packageName)) {
      await uninstallRuntimePackage(this.runtimeRoot, packageName).catch((error: unknown) => {
        console.warn(`[dynamic] Could not remove unused package ${packageName}:`, error instanceof Error ? error.message : error);
      });
    }
    await this.reload();
    return this.snapshot();
  }

  async updateRegistry(registry: string): Promise<HostSettingsDto> {
    this.config.registry = new URL(registry).href.replace(/\/$/, "");
    await writeDynamicAppConfig(this.configPath, this.config);
    return this.hostSettings();
  }

  async bridgeData(instanceId: string): Promise<unknown> {
    const component = this.get(instanceId);
    const root = await this.getMicrofrontendData(component.instance);
    const registered = new Map<string, RegisteredAction>();
    const serialized = serializeBridge(root, "", registered, new WeakSet());
    this.actions.set(instanceId, registered);
    return serialized;
  }

  async callAction(instanceId: string, path: string, args: unknown[]): Promise<unknown> {
    if (!this.actions.has(instanceId)) await this.bridgeData(instanceId);
    const action = this.actions.get(instanceId)?.get(path);
    if (!action) throw new Error(`Unknown component action: ${path}`);
    const value = await action.invoke(...args);
    return serializeTransport(value);
  }

  async updateConfig(instanceId: string, config: Record<string, unknown>): Promise<RuntimeComponentDto> {
    const component = this.get(instanceId);
    component.definition.config = config;
    await writeDynamicAppConfig(this.configPath, this.config);
    await this.reload();
    return this.get(instanceId).descriptor;
  }

  async close(): Promise<void> {
    await this.agentRuntime?.stop().catch((error: unknown) => console.warn("[dynamic] Could not stop message runtime:", error));
    this.agentRuntime = undefined;
    await Promise.allSettled([...new Set(this.components.map(({ instance }) => instance).filter(Boolean))].map(closeInstance));
  }

  async reload(): Promise<RuntimeSnapshot> {
    await this.close();
    this.actions.clear();
    await this.load();
    return this.snapshot();
  }

  private get(instanceId: string): LoadedComponent {
    const component = this.components.find(({ descriptor }) => descriptor.instanceId === instanceId);
    if (!component) throw new Error(`Unknown component instance: ${instanceId}`);
    return component;
  }

  private async interfaceKind(definition: DynamicComponentConfig): Promise<DynamicManifestInterface["kind"]> {
    const manifest = await loadPackageManifest(installedPackageRoot(this.runtimeRoot, definition.package));
    const manifestInterface = manifest.interfaces.find(({ id }) => id === definition.interface);
    if (!manifestInterface) throw new Error(`${definition.package}@${manifest.version} does not provide interface ${definition.interface}`);
    return manifestInterface.kind;
  }

  private async loadComponent(definition: DynamicComponentConfig): Promise<LoadedComponent> {
    const packageRoot = installedPackageRoot(this.runtimeRoot, definition.package);
    const [manifest, packageJson] = await Promise.all([
      loadPackageManifest(packageRoot),
      readPackageJson(packageRoot),
    ]);
    const manifestInterface = manifest.interfaces.find((candidate) => candidate.id === definition.interface);
    if (!manifestInterface) {
      throw new Error(`${definition.package}@${manifest.version} does not provide interface ${definition.interface}`);
    }
    let instance: unknown;
    let runtimeError: string | undefined;
    const enabled = definition.enabled !== false;
    if (enabled) {
      try {
        const shared = this.components.find((component) =>
          component.definition.package === definition.package &&
          component.manifestInterface.className === manifestInterface.className &&
          component.instance,
        );
        if (shared) {
          instance = shared.instance;
        } else {
          const runtimeEntry = resolvePackageEntry(packageRoot, packageJson, manifestInterface.entry);
          const module = await import(versionedModuleUrl(runtimeEntry, manifest.version)) as RuntimeModule;
          instance = instantiate(module, manifestInterface, this.componentOptions(manifestInterface, definition));
        }
      } catch (error) {
        runtimeError = error instanceof Error ? error.message : String(error);
        console.warn(`[dynamic] ${definition.instanceId} is not active: ${runtimeError}`);
      }
    }
    const web = manifestInterface.web
      ? {
          moduleUrl: viteFileUrl(resolvePackageEntry(packageRoot, packageJson, manifestInterface.web.entry)),
          exportName: manifestInterface.web.export,
          styleUrl: manifestInterface.web.styles
            ? viteFileUrl(resolvePackageEntry(packageRoot, packageJson, manifestInterface.web.styles))
            : undefined,
        }
      : undefined;
    const instanceId = definition.instanceId!;
    return {
      definition,
      manifestInterface,
      instance,
      descriptor: {
        instanceId,
        kind: manifestInterface.kind,
        id: manifestInterface.id,
        packageId: manifest.id,
        packageName: definition.package,
        version: manifest.version,
        description: manifestInterface.description,
        config: definition.config ?? {},
        web,
        hasDataBridge: hasMicrofrontendData(instance),
        enabled,
        runtimeError,
      },
    };
  }

  private async getMicrofrontendData(instance: unknown): Promise<unknown> {
    if (!instance || typeof instance !== "object") return {};
    const candidate = instance as {
      microfrontendData?: () => unknown | Promise<unknown>;
      webData?: () => unknown | Promise<unknown>;
    };
    if (typeof candidate.microfrontendData === "function") return candidate.microfrontendData();
    if (typeof candidate.webData === "function") return candidate.webData();
    return {};
  }

  private componentOptions(manifestInterface: DynamicManifestInterface, definition: DynamicComponentConfig): Record<string, unknown> {
    const configured = definition.config ?? {};
    const environment = this.environmentInstance();
    const options: Record<string, unknown> = {
      cwd: this.projectRoot,
      workingDirectory: this.projectRoot,
      ...(environment ? { env: environment } : {}),
    };
    if (manifestInterface.className === "CompositeEnvironment") {
      options.providers = this.components.filter(({ descriptor, instance }) => descriptor.kind === "env" && isEnvironment(instance)).map(({ instance }) => instance);
    }
    if (manifestInterface.kind === "orchestrator" || manifestInterface.kind === "agent") {
      const model = this.preferredModel();
      const capabilityDiscovery = this.components.find(({ descriptor, instance }) => descriptor.kind === "discovery" && isCapabilityDiscovery(instance))?.instance;
      if (model) options.model = model;
      if (capabilityDiscovery) options.capabilityDiscovery = capabilityDiscovery;
    }
    const memory = this.components.find(({ descriptor, instance }) =>
      descriptor.kind === "memory" && isMemory(instance),
    )?.instance;
    if (memory) options.memory = memory;
    const database = this.components.find(({ descriptor, instance }) => descriptor.kind === "database" && instance)?.instance;
    if (database) {
      const provider = database as { scope?: (namespace: string) => unknown };
      options.database = typeof provider.scope === "function"
        ? provider.scope((definition.instanceId ?? manifestInterface.id).replaceAll(":", "-"))
        : database;
    }
    for (const entry of manifestInterface.config ?? []) {
      if (typeof entry.key !== "string") continue;
      let value = configured[entry.key];
      if ((value === undefined || value === "") && typeof entry.env === "string") value = environment?.get(entry.env) ?? process.env[entry.env];
      if ((value === undefined || value === "") && Object.hasOwn(entry, "default")) value = entry.default;
      if ((value === undefined || value === "") && entry.required === true) throw new Error(`Missing required config "${entry.key}"${typeof entry.env === "string" ? ` (${entry.env})` : ""}`);
      if (value !== undefined && value !== "") options[entry.key] = coerceConfigValue(value, entry.type);
    }
    for (const [key, value] of Object.entries(configured)) if (value !== undefined) options[key] = value;
    return options;
  }

  private environmentInstance(): { get(key: string): string | undefined } | undefined {
    const environments = this.components.filter(({ descriptor, instance }) => descriptor.kind === "env" && isEnvironment(instance));
    return (environments.find(({ manifestInterface }) => manifestInterface.className === "CompositeEnvironment") ?? environments[0])?.instance as { get(key: string): string | undefined } | undefined;
  }

  private preferredModel(): unknown {
    const models = this.components.filter(({ descriptor, instance }) => descriptor.kind === "ai" && instance);
    return (models.find(({ definition }) => definition.config?.role === "routing") ?? models[0])?.instance;
  }

  private async registerActionCapabilities(): Promise<void> {
    const discovery = this.components.find(({ descriptor, instance }) => descriptor.kind === "discovery" && isCapabilityDiscovery(instance))?.instance as { register(capability: unknown): Promise<void> } | undefined;
    if (!discovery) return;
    for (const { descriptor, instance } of this.components) {
      // A package may expose a capability from another live interface. Cronjob,
      // for example, must use the same object for its input listener and its
      // management tool so newly-created schedules become active immediately.
      if (descriptor.enabled !== false && isCapability(instance)) await discovery.register(instance);
    }
  }

  private startAgentRuntime(): void {
    const inputs = uniqueInstances(this.components.filter(({ descriptor }) => descriptor.kind === "input").map(({ instance }) => instance).filter(isInputInterface));
    const outputs = uniqueInstances(this.components.filter(({ descriptor }) => descriptor.kind === "output").map(({ instance }) => instance).filter(isOutputInterface));
    const memory = this.components.find(({ descriptor, instance }) => descriptor.kind === "memory" && isMemory(instance))?.instance as Memory | undefined;
    const orchestrator = this.components.find(({ descriptor, instance }) => descriptor.kind === "orchestrator" && isOrchestrator(instance))?.instance as Orchestrator | undefined;
    const agentLoop = this.components.find(({ descriptor, instance }) => descriptor.kind === "agent" && isAgentLoop(instance))?.instance as AgentLoop | undefined;
    if (!inputs.length || !outputs.length || !memory || !orchestrator || !agentLoop) return;
    this.agentRuntime = new AgentRuntime({
      inputs,
      outputs,
      memory,
      orchestrator,
      agentLoop,
      stream: this.environmentInstance()?.get("AI_STREAM") !== "false",
    });
    this.agentRuntime.start();
    console.log(`[dynamic] message runtime started (${inputs.map(({ channel }) => channel).join(", ")})`);
  }
}

function assignUniqueInstanceIds(components: DynamicComponentConfig[]): void {
  const used = new Set<string>();
  for (const component of components) {
    const base = component.instanceId ?? `${component.interface}:1`;
    let instanceId = base;
    let suffix = 2;
    while (used.has(instanceId)) instanceId = `${base}:${suffix++}`;
    component.instanceId = instanceId;
    used.add(instanceId);
  }
}

function kindPriority(kind: DynamicManifestInterface["kind"]): number {
  return { env: 0, database: 1, memory: 2, ai: 3, discovery: 4, input: 5, output: 5, action: 5, agent: 6, orchestrator: 7 }[kind];
}

function isEnvironment(value: unknown): value is { get(key: string): string | undefined } {
  return Boolean(value && typeof value === "object" && typeof (value as { get?: unknown }).get === "function");
}

function isCapabilityDiscovery(value: unknown): value is { register(capability: unknown): Promise<void>; discover(query?: unknown): Promise<unknown> } {
  return Boolean(value && typeof value === "object" && typeof (value as { register?: unknown }).register === "function" && typeof (value as { discover?: unknown }).discover === "function");
}

function isCapability(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as { manifest?: unknown }).manifest && typeof (value as { execute?: unknown }).execute === "function");
}

function isInputInterface(value: unknown): value is InputInterface {
  return Boolean(value && typeof value === "object" && typeof (value as { start?: unknown }).start === "function" && typeof (value as { stop?: unknown }).stop === "function");
}

function isOutputInterface(value: unknown): value is OutputInterface {
  return Boolean(value && typeof value === "object" && typeof (value as { channel?: unknown }).channel === "string" && typeof (value as { write?: unknown }).write === "function");
}

function isMemory(value: unknown): value is Memory {
  return Boolean(value && typeof value === "object" && typeof (value as { remember?: unknown }).remember === "function" && typeof (value as { recall?: unknown }).recall === "function");
}

function isOrchestrator(value: unknown): value is Orchestrator {
  return Boolean(value && typeof value === "object" && typeof (value as { orchestrate?: unknown }).orchestrate === "function");
}

function isAgentLoop(value: unknown): value is AgentLoop {
  return Boolean(value && typeof value === "object" && typeof (value as { run?: unknown }).run === "function");
}

function uniqueInstances<T extends object>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

function coerceConfigValue(value: unknown, type: unknown): unknown {
  if (type === "number") { const number = typeof value === "number" ? value : Number(value); if (!Number.isFinite(number)) throw new Error(`Invalid number config value: ${String(value)}`); return number; }
  if (type !== "boolean" || typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`Invalid boolean config value: ${String(value)}`);
}

function manifestDefaults(manifestInterface: DynamicManifestInterface): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const item of manifestInterface.config ?? []) {
    if (typeof item.key === "string" && Object.hasOwn(item, "default")) result[item.key] = item.default;
  }
  return result;
}

async function readPackageJson(packageRoot: string): Promise<InstalledPackageJson> {
  return JSON.parse(await readFile(join(packageRoot, "package.json"), "utf8")) as InstalledPackageJson;
}

function resolvePackageEntry(
  packageRoot: string,
  packageJson: InstalledPackageJson,
  entry: string,
): string {
  const key = entry === "." ? "." : `./${entry.replace(/^\.\//, "")}`;
  const target = exportTarget(packageJson.exports, key) ??
    (key === "." ? packageJson.main : undefined);
  if (!target || !target.startsWith("./")) {
    throw new Error(`Package export ${key} is not defined in ${join(packageRoot, "package.json")}`);
  }
  const resolved = resolve(packageRoot, target);
  if (resolved !== packageRoot && !resolved.startsWith(`${packageRoot}${sep}`)) {
    throw new Error(`Package export ${key} resolves outside its package`);
  }
  return resolved;
}

export function versionedModuleUrl(entry: string, version: string): string {
  const url = pathToFileURL(entry);
  url.searchParams.set("agent-os-package-version", version);
  return url.href;
}

function exportTarget(exportsValue: unknown, key: string): string | undefined {
  if (typeof exportsValue === "string") return key === "." ? exportsValue : undefined;
  if (!exportsValue || typeof exportsValue !== "object" || Array.isArray(exportsValue)) return undefined;
  const record = exportsValue as Record<string, unknown>;
  if (!Object.keys(record).some((entry) => entry.startsWith("."))) {
    return key === "." ? conditionalTarget(record) : undefined;
  }
  if (record[key] !== undefined) return conditionalTarget(record[key]);
  for (const [pattern, value] of Object.entries(record)) {
    const wildcard = pattern.indexOf("*");
    if (wildcard < 0) continue;
    const prefix = pattern.slice(0, wildcard);
    const suffix = pattern.slice(wildcard + 1);
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
    const replacement = key.slice(prefix.length, key.length - suffix.length);
    return conditionalTarget(value, replacement);
  }
  return undefined;
}

function conditionalTarget(value: unknown, wildcard?: string): string | undefined {
  if (typeof value === "string") return wildcard === undefined ? value : value.replaceAll("*", wildcard);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  for (const condition of ["import", "browser", "default"]) {
    const target = conditionalTarget(record[condition], wildcard);
    if (target) return target;
  }
  return undefined;
}

function instantiate(
  module: RuntimeModule,
  manifestInterface: DynamicManifestInterface,
  options: Record<string, unknown>,
): unknown {
  const exportName = manifestInterface.className ??
    (manifestInterface.export !== "." ? manifestInterface.export : undefined);
  if (!exportName) return undefined;
  const candidate = module[exportName];
  if (typeof candidate !== "function") {
    throw new Error(`Runtime module does not export ${exportName}`);
  }
  return new (candidate as Constructor)(options);
}

function hasMicrofrontendData(instance: unknown): boolean {
  if (!instance || typeof instance !== "object") return false;
  const value = instance as { microfrontendData?: unknown; webData?: unknown };
  return typeof value.microfrontendData === "function" || typeof value.webData === "function";
}

function serializeBridge(
  value: unknown,
  path: string,
  actions: Map<string, RegisteredAction>,
  seen: WeakSet<object>,
): unknown {
  if (value === null || value === undefined || typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return { type: "bytes", byteLength: value.byteLength };
  if (typeof value === "function") {
    actions.set(path, { invoke: value as (...args: unknown[]) => unknown });
    return { __agentOsAction: path } satisfies BridgeActionMarker;
  }
  if (typeof value !== "object") return String(value);
  if (seen.has(value)) return undefined;
  seen.add(value);
  if (Array.isArray(value)) return value.map((item, index) => serializeBridge(item, `${path}.${index}`, actions, seen));

  const output: Record<string, unknown> = {};
  const plain = Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null;
  if (!plain) return undefined;
  for (const [key, item] of Object.entries(value)) {
    output[key] = serializeBridge(item, joinPath(path, key), actions, seen);
  }
  seen.delete(value);
  return output;
}

function serializeTransport(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Uint8Array) return { type: "bytes", byteLength: value.byteLength };
  if (Array.isArray(value)) return value.map(serializeTransport);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serializeTransport(item)]));
  }
  return value;
}

function joinPath(parent: string, child: string): string {
  return parent ? `${parent}.${child}` : child;
}

function viteFileUrl(path: string): string {
  return `/@fs/${path}`;
}

async function closeInstance(instance: unknown): Promise<void> {
  if (!instance || typeof instance !== "object") return;
  const close = (instance as { close?: () => unknown; stop?: () => unknown }).close ??
    (instance as { stop?: () => unknown }).stop;
  if (typeof close === "function") await close.call(instance);
}
