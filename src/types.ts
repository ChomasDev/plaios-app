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
  /** Model instance used wherever a component does not name its own `system1Instance`/`system2Instance`. */
  active?: Partial<Record<ModelKind, string>>;
}

export type ModelKind = "system1" | "system2";
export const MODEL_KINDS: readonly ModelKind[] = ["system1", "system2"];

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
  /** The instance the runtime actually uses when several fill the slot. */
  active?: string;
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

/** A file the user attached in the web chat; `GET /api/uploads/file?id=` serves it. */
export interface ChatAttachmentDto { id: string; name: string; mediaType: string; size: number }

/** One question and everything the agent did to answer it, as the chat shows it. */
export interface ChatTurnDto {
  /** Client clock when asked; also the turn id the server streams under. */
  id: number;
  question: string;
  attachments?: ChatAttachmentDto[];
  answer?: string;
  steps?: ChatStep[];
  components: string[];
  error?: string;
  streaming?: boolean;
  /** When the turn finished; the work log measures from the question (`id`) to here. */
  endedAt?: string;
}

/** Sidebar state, after T3 Code's thread pills; null once the user has seen how it ended. */
export type ConversationStatus = "working" | "awaiting-input" | "failed" | "completed";

export interface ConversationSummaryDto {
  id: string;
  title: string;
  startedAt: string;
  updatedAt: string;
  turnCount: number;
  status: ConversationStatus | null;
}
export interface ConversationDto extends Omit<ConversationSummaryDto, "turnCount" | "status"> { turns: ChatTurnDto[] }

export interface PlanItem { text: string; status: "pending" | "in_progress" | "done" }

/** One line of the chat's work log; a later step with the same id updates it. */
export interface ChatStep {
  id: string;
  label: string;
  status: "running" | "done" | "failed";
  /** One-line preview shown next to the label. */
  detail?: string;
  /** Sub-agent steps nest under the step that started them. */
  parentId?: string;
  kind?: "plan" | "tool" | "agent" | "todo" | "thought";
  /** Appended to `output`: streamed thinking sends only what is new. */
  delta?: string;
  /** The agent's checklist, for `todo` steps. */
  items?: PlanItem[];
  startedAt?: string;
  endedAt?: string;
  /** Full arguments and result, shown when the line is expanded. */
  input?: string;
  output?: string;
}

export interface HostLogEntry { seq: number; at: string; level: "debug" | "info" | "warn" | "error"; text: string }

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
