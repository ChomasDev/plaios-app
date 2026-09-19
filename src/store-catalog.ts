import type { InterfaceKind, RuntimeSnapshot, StorePackageDto } from "./types.js";

const HIDDEN_STORE_PACKAGES = new Set([
  "agentos",
  "@agent-os/app-dynamic",
  "@agent-os/package-manager",
  "@agent-os/microfrontend",
  "@agent-os/core",
  "@agent-os/cli",
]);

export interface RegistryPackage {
  name: string;
  version: string;
  description?: string;
  keywords: string[];
}

export function isStoreCatalogPackage(
  name: string,
  keywords: readonly string[],
  installed = false,
): boolean {
  if (installed) return true;
  if (HIDDEN_STORE_PACKAGES.has(name)) return false;
  return keywords.includes("capability") ||
    keywords.includes("agent-os") ||
    name.startsWith("@agent-os/");
}

export function kindsFromKeywords(keywords: readonly string[]): InterfaceKind[] {
  const tokens = new Set(keywords.map((keyword) => keyword.toLowerCase()));
  const kinds: InterfaceKind[] = [];
  if (tokens.has("environment") || tokens.has("env")) kinds.push("env");
  if (tokens.has("ai") && !tokens.has("orchestrator") && !tokens.has("action")) kinds.push("ai");
  if (tokens.has("discovery")) kinds.push("discovery");
  if (tokens.has("database") || tokens.has("sqlite")) kinds.push("database");
  if (tokens.has("memory") && !tokens.has("action") && !tokens.has("retrieval")) kinds.push("memory");
  if (tokens.has("orchestrator")) kinds.push("orchestrator");
  if (tokens.has("agent") && !tokens.has("orchestrator")) kinds.push("agent");
  if (tokens.has("input")) kinds.push("input");
  if (tokens.has("output")) kinds.push("output");
  if (tokens.has("action")) kinds.push("action");
  return kinds;
}

export async function searchRegistry(registry: string): Promise<RegistryPackage[]> {
  try {
    const endpoint = new URL("/-/v1/search", `${registry}/`);
    // An empty query keeps local Verdaccio catalogs fast and avoids an uplink search.
    endpoint.searchParams.set("text", "");
    endpoint.searchParams.set("size", "250");
    const response = await fetch(endpoint, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error(`Registry search failed (${response.status})`);
    const body = await response.json() as { objects?: unknown };
    const objects = Array.isArray(body.objects) ? body.objects : [];
    const packages: RegistryPackage[] = [];
    for (const entry of objects) {
      if (!isRecord(entry) || !isRecord(entry.package) || typeof entry.package.name !== "string") continue;
      const name = entry.package.name;
      const value = entry.package;
      const keywords = Array.isArray(value.keywords)
        ? value.keywords.filter((keyword): keyword is string => typeof keyword === "string")
        : [];
      packages.push({
        name,
        version: typeof value.version === "string" ? value.version : "",
        description: typeof value.description === "string" ? value.description : undefined,
        keywords,
      });
    }
    return packages;
  } catch (error) {
    throw new Error(`Registry is unreachable (${error instanceof Error ? error.message : String(error)})`);
  }
}

export async function listStorePackages(snapshot: RuntimeSnapshot): Promise<StorePackageDto[]> {
  const objects = await searchRegistry(snapshot.registry);
  const instances = new Map<string, number>();
  const installedVersions = new Map<string, string>();
  for (const component of snapshot.components) {
    instances.set(component.packageName, (instances.get(component.packageName) ?? 0) + 1);
    installedVersions.set(component.packageName, component.version);
  }
  const resolved = await Promise.all(objects.flatMap((candidate) => {
    const installed = instances.has(candidate.name);
    if (!isStoreCatalogPackage(candidate.name, candidate.keywords, installed)) return [];
    return [resolveStorePackage(snapshot.registry, candidate, installedVersions, instances)];
  }));
  return resolved
    .filter((item): item is StorePackageDto => Boolean(item))
    .sort((left, right) => Number(right.installed) - Number(left.installed) || left.name.localeCompare(right.name));
}

export function isNewerVersion(candidate: string, installed?: string): boolean {
  if (!installed || candidate === installed) return false;
  const next = parseSemver(candidate);
  const current = parseSemver(installed);
  if (!next || !current) return false;
  for (let index = 0; index < 3; index += 1) {
    if (next.numbers[index] !== current.numbers[index]) {
      return next.numbers[index]! > current.numbers[index]!;
    }
  }
  if (next.prerelease === current.prerelease) return false;
  if (!next.prerelease) return true;
  if (!current.prerelease) return false;
  return next.prerelease.localeCompare(current.prerelease, undefined, { numeric: true }) > 0;
}

async function resolveStorePackage(
  registry: string,
  candidate: RegistryPackage,
  installedVersions: Map<string, string>,
  instances: Map<string, number>,
): Promise<StorePackageDto | undefined> {
  const version = candidate.version || await latestPackageVersion(registry, candidate.name);
  if (!version) return undefined;
  return {
    name: candidate.name,
    version,
    description: candidate.description,
    keywords: candidate.keywords,
    installedVersion: installedVersions.get(candidate.name),
    installed: instances.has(candidate.name),
    updateAvailable: isNewerVersion(version, installedVersions.get(candidate.name)),
    instances: instances.get(candidate.name) ?? 0,
  };
}

async function latestPackageVersion(registry: string, packageName: string): Promise<string | undefined> {
  try {
    const response = await fetch(new URL(`/${encodeURIComponent(packageName)}`, `${registry}/`), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) return undefined;
    const metadata = await response.json() as unknown;
    if (!isRecord(metadata) || !isRecord(metadata["dist-tags"])) return undefined;
    const latest = metadata["dist-tags"].latest;
    return typeof latest === "string" ? latest : undefined;
  } catch {
    return undefined;
  }
}

function parseSemver(value: string): { numbers: [number, number, number]; prerelease: string } | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) return undefined;
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? "",
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
