import type { Capability, CapabilityManifest, CapabilityResult, UIComponentSpec } from "@plaios/core/domain";

/** What the host knows about one live capability, gathered by the runtime when the tool runs. */
export interface CapabilityDocsEntry {
  capability: Pick<Capability, "manifest"> & Partial<Pick<Capability, "docs" | "uiComponents">>;
  packageName: string;
  configFields: readonly Record<string, unknown>[];
  configValue(key: string, env?: string): unknown;
}

export interface CapabilityDocsInput { capabilityId: string }

export const CAPABILITY_DOCS_ID = "agent-os.docs";

const manifest: CapabilityManifest = {
  id: CAPABILITY_DOCS_ID,
  version: "1.0.0",
  name: "read_capability_docs",
  description: "Reads the full documentation of another capability: when to use it, how its inputs work, its limits, its configuration and the chat components it can show. Call it before using a capability you are unsure about, or when a call failed and you need to know why.",
  inputSchema: {
    type: "object",
    properties: { capabilityId: { type: "string", description: "The id of the capability to read, e.g. \"web.search\"." } },
    required: ["capabilityId"],
    additionalProperties: false,
  },
  tags: ["docs", "help", "capability", "documentation", "how"],
  execution: { timeoutMs: 5_000, idempotent: true },
};

/** Built into the host so every agent can read any capability's docs, whatever packages are installed. */
export class CapabilityDocsCapability implements Capability<CapabilityDocsInput, { capabilityId: string; markdown: string }> {
  readonly manifest = manifest;

  constructor(private readonly entries: () => readonly CapabilityDocsEntry[]) {}

  uiComponents(): readonly UIComponentSpec[] { return []; }

  docs(): string { return "Pass the id of any capability to read its documentation. Unknown ids return the list of available ids."; }

  async execute(input: CapabilityDocsInput): Promise<CapabilityResult<{ capabilityId: string; markdown: string }>> {
    const entries = this.entries().filter((entry) => entry.capability.manifest.id !== CAPABILITY_DOCS_ID);
    const entry = entries.find((candidate) => candidate.capability.manifest.id === input.capabilityId?.trim());
    if (!entry) {
      const ids = entries.map((candidate) => candidate.capability.manifest.id).join(", ");
      return { success: false, error: { code: "UNKNOWN_CAPABILITY", message: `No capability "${input.capabilityId}". Available: ${ids}`, retryable: false } };
    }
    return { success: true, data: { capabilityId: input.capabilityId, markdown: renderDocs(entry) } };
  }
}

/** The capability's own docs, then what the host knows: inputs, examples, configuration and chat components. */
export function renderDocs(entry: CapabilityDocsEntry): string {
  const { manifest: own } = entry.capability;
  const sections = [
    `# ${own.name} (${own.id})`,
    own.description,
    entry.capability.docs?.().trim() || "_This capability ships no docs of its own._",
    `## Input schema\n\`\`\`json\n${JSON.stringify(own.inputSchema, null, 2)}\n\`\`\``,
  ];
  if (own.examples?.length) sections.push(`## Examples\n${own.examples.map((example) => `- "${example.request}" → \`${JSON.stringify(example.arguments)}\``).join("\n")}`);
  const config = configLines(entry);
  if (config.length) sections.push(`## Configuration (${entry.packageName})\n${config.join("\n")}`);
  const components = entry.capability.uiComponents?.() ?? [];
  if (components.length) sections.push(`## Chat components\n${components.map(componentLine).join("\n")}`);
  return sections.join("\n\n");
}

function configLines(entry: CapabilityDocsEntry): string[] {
  return entry.configFields.flatMap((field) => {
    if (typeof field.key !== "string") return [];
    const env = typeof field.env === "string" ? field.env : undefined;
    const value = entry.configValue(field.key, env);
    // Secrets never leave the host: the agent only learns whether one is set.
    const shown = field.type === "secret" ? (isSet(value) ? "set" : "not set") : isSet(value) ? JSON.stringify(value) : "not set";
    const description = typeof field.description === "string" ? ` — ${field.description}` : "";
    return [`- \`${field.key}\`${env ? ` (env ${env})` : ""}: ${shown}${description}`];
  });
}

function componentLine(spec: UIComponentSpec): string {
  const props = spec.props.map((prop) => `${prop.name}${prop.optional ? "?" : ""}: ${prop.type}`).join(", ");
  return `- \`${spec.name}(${props})\`: ${spec.description}`;
}

function isSet(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}
