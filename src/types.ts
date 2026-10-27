export type InterfaceKind =
  | "env"
  | "system1"
  | "system2"
  | "discovery"
  | "database"
  | "memory"
  | "orchestrator"
  | "agent"
  | "input"
  | "output"
  | "action";

export const INTERFACE_KINDS: readonly InterfaceKind[] = [
  "env",
  "system1",
  "system2",
  "discovery",
  "database",
  "memory",
  "orchestrator",
  "agent",
  "input",
  "output",
  "action",
];

export const CORE_KINDS: readonly InterfaceKind[] = [
  "env",
  "system1",
  "system2",
  "discovery",
  "database",
  "memory",
  "orchestrator",
  "agent",
];

export const TOGGLE_KINDS: readonly InterfaceKind[] = ["input", "output", "action"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export interface DynamicComponentConfig {
  package: string;
  version?: string;
  interface: string;
  instanceId?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface DynamicAppConfig {
  schemaVersion: 1;
  registry: string;
  server: {
    host: string;
    port: number;
  };
  components: DynamicComponentConfig[];
}

export interface ManifestWebSurface {
  entry: string;
  export: string;
  styles?: string;
  /** True when the yaml has no `web:` and the conventional `./web/<kind>` entry is assumed. */
  conventional?: boolean;
}

export interface DynamicManifestInterface {
  id: string;
  kind: InterfaceKind;
  name: string;
  entry: string;
  export: string;
  className?: string;
  description?: string;
  web?: ManifestWebSurface;
  config?: readonly Record<string, unknown>[];
  required?: readonly string[];
  optional?: readonly string[];
  startup?: { when: "always" | "ifConfigured" | "manual" };
}

export interface DynamicPackageManifest {
  schemaVersion: 1;
  id: string;
  name: string;
  version: string;
  description?: string;
  interfaces: DynamicManifestInterface[];
}

export interface RuntimeWebSurface {
  moduleUrl: string;
  exportName: string;
  styleUrl?: string;
}

export interface RuntimeComponentDto {
  instanceId: string;
  kind: InterfaceKind;
  id: string;
  packageId: string;
  packageName: string;
  version: string;
  description?: string;
  config: Record<string, unknown>;
  configFields?: readonly Record<string, unknown>[];
  web?: RuntimeWebSurface;
  hasDataBridge: boolean;
  /** Message channel for input/output components, read from the running instance. */
  channel?: string;
  enabled: boolean;
  runtimeError?: string;
}

export interface RuntimeSnapshot {
  configPath: string;
  registry: string;
  components: RuntimeComponentDto[];
}

export interface StoreMutationResult extends RuntimeSnapshot {
  restarting?: true;
}

export interface RuntimeSlotOptionDto {
  packageName: string;
  version: string;
  description?: string;
}

export interface RuntimeSlotDto {
  kind: InterfaceKind;
  current: Array<{
    instanceId: string;
    packageName: string;
    version: string;
    interfaceId: string;
    enabled: boolean;
  }>;
  options: RuntimeSlotOptionDto[];
}

export interface HostSettingsDto {
  configPath: string;
  registry: string;
  server: { host: string; port: number };
  host: {
    packageName: "plaios";
    current: string;
    latest?: string;
    updateAvailable: boolean;
  };
  runtimePackages: Array<{ name: string; current: string }>;
  slots: RuntimeSlotDto[];
  registryReachable: boolean;
}

export interface AgentRunDto {
  at: string;
  channel: string;
  outputChannel?: string;
  capabilityIds: string[];
  durationMs: number;
  ok: boolean;
  error?: string;
}

export interface TelemetryDto {
  startedAt: string;
  uptimeSec: number;
  host: {
    hostname: string;
    platform: string;
    node: string;
    cpus: number;
    loadavg: [number, number, number];
    memoryTotal: number;
    memoryFree: number;
    rss: number;
    heapUsed: number;
  };
  runs: { total: number; failed: number; recent: AgentRunDto[] };
}

export interface RuntimeSwapResult extends RuntimeSnapshot {
  kind: InterfaceKind;
  packageName: string;
  version: string;
}

export interface HostUpdateResult {
  version: string;
  restarting: true;
}

export interface StorePackageDto {
  name: string;
  version: string;
  installedVersion?: string;
  description?: string;
  keywords: string[];
  installed: boolean;
  updateAvailable: boolean;
  instances: number;
  kinds: InterfaceKind[];
  updatedAt?: string;
}

/** Everything the Store's package page shows, read from the registry's packument. */
export interface StorePackageDetailDto extends StorePackageDto {
  readme?: string;
  license?: string;
  homepage?: string;
  repository?: string;
  author?: string;
  createdAt?: string;
  versions: Array<{ version: string; date?: string }>;
  dependencies: string[];
  peerDependencies: string[];
  unpackedSize?: number;
  fileCount?: number;
}

export interface BridgeActionMarker {
  __agentOsAction: string;
}

/** Mirror of the microfrontend package's OpenUI component contract, kept here so server declarations never pull in React sources. */
export interface OpenUIPropSpec {
  name: string;
  type: "string" | "string[]" | "number" | "boolean";
  optional?: boolean;
  description?: string;
}

export interface OpenUIComponentSpec {
  name: string;
  description: string;
  props: readonly OpenUIPropSpec[];
}
