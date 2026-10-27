import { kindsFromKeywords, type RegistryPackage } from "./store-catalog.js";
import type {
  DynamicComponentConfig,
  DynamicManifestInterface,
  InterfaceKind,
  RuntimeSlotDto,
} from "./types.js";
import { INTERFACE_KINDS } from "./types.js";

export interface SlotCurrentComponent {
  kind: InterfaceKind;
  instanceId: string;
  packageName: string;
  version: string;
  interfaceId: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export function buildRuntimeSlots(
  current: readonly SlotCurrentComponent[],
  catalog: readonly RegistryPackage[],
): RuntimeSlotDto[] {
  return INTERFACE_KINDS.map((kind) => {
    const items = current.filter((item) => item.kind === kind);
    const options = new Map<string, RuntimeSlotDto["options"][number]>();
    for (const item of items) {
      options.set(item.packageName, {
        packageName: item.packageName,
        version: item.version,
      });
    }
    for (const entry of catalog) {
      if (!kindsFromKeywords(entry.keywords).includes(kind) || !entry.version) continue;
      const existing = options.get(entry.name);
      options.set(entry.name, {
        packageName: entry.name,
        version: entry.version,
        description: entry.description ?? existing?.description,
      });
    }
    return {
      kind,
      current: items.map(({ instanceId, packageName, version, interfaceId, enabled }) => ({
        instanceId,
        packageName,
        version,
        interfaceId,
        enabled: enabled !== false,
      })),
      options: [...options.values()].sort((left, right) => left.packageName.localeCompare(right.packageName)),
    };
  }).filter((slot) => slot.current.length > 0 || slot.options.length > 0);
}

export function planKindReplacement(
  existing: readonly SlotCurrentComponent[],
  interfaces: readonly DynamicManifestInterface[],
  packageName: string,
  version: string,
): DynamicComponentConfig[] {
  return interfaces.map((manifestInterface, index) => {
    const previous = existing[index];
    return {
      package: packageName,
      version,
      interface: manifestInterface.id,
      instanceId: previous?.instanceId ?? `${manifestInterface.kind}:${manifestInterface.id}`,
      ...(previous?.enabled === false ? { enabled: false } : {}),
      config: {
        ...manifestDefaults(manifestInterface),
        ...(previous?.config ?? {}),
      },
    };
  });
}

export function replaceKindComponents(
  components: readonly DynamicComponentConfig[],
  kindOf: ReadonlyMap<string, InterfaceKind>,
  kind: InterfaceKind,
  replacements: readonly DynamicComponentConfig[],
): DynamicComponentConfig[] {
  const result: DynamicComponentConfig[] = [];
  let inserted = false;
  for (const component of components) {
    const instanceKind = kindOf.get(component.instanceId ?? "");
    if (instanceKind !== kind) {
      result.push(component);
      continue;
    }
    if (!inserted) {
      result.push(...replacements);
      inserted = true;
    }
  }
  if (!inserted) result.push(...replacements);
  return result;
}

export function manifestDefaults(manifestInterface: DynamicManifestInterface): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const item of manifestInterface.config ?? []) {
    if (typeof item.key === "string" && Object.hasOwn(item, "default")) result[item.key] = item.default;
  }
  return result;
}
