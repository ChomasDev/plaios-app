export type InterfaceKind =
  | "env"
  | "ai"
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
  "ai",
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
  "ai",
  "discovery",
  "database",
  "memory",
  "orchestrator",
  "agent",
];

export const TOGGLE_KINDS: readonly InterfaceKind[] = ["input", "output", "action"];

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
  web?: RuntimeWebSurface;
  hasDataBridge: boolean;
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
    packageName: "agentos";
    current: string;
    latest?: string;
    updateAvailable: boolean;
  };
  runtimePackages: Array<{ name: string; current: string }>;
  slots: RuntimeSlotDto[];
  registryReachable: boolean;
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
}

export interface BridgeActionMarker {
  __agentOsAction: string;
}
