import { latestPackageVersion } from "./host-settings.js";
import { isRecord, type InterfaceKind, type RuntimeSnapshot, type StorePackageDetailDto, type StorePackageDto } from "./types.js";

const HIDDEN_STORE_PACKAGES = new Set([
  "plaios",
  "@plaios/app-dynamic",
  "@plaios/package-manager",
  "@plaios/microfrontend",
  // Renamed to @plaios/jev-orchestrator.
  "@plaios/jev-orhcestator",
  "@plaios/core",
  "@plaios/cli",
]);

export interface RegistryPackage {
  name: string;
  version: string;
  description?: string;
  keywords: string[];
  updatedAt?: string;
}

type PackumentDetail = Omit<StorePackageDetailDto, "installedVersion" | "installed" | "updateAvailable" | "instances">;

export function isStoreCatalogPackage(
  name: string,
  keywords: readonly string[],
  installed = false,
): boolean {
  if (installed) return true;
  if (HIDDEN_STORE_PACKAGES.has(name)) return false;
  return keywords.includes("capability") ||
    keywords.includes("plaios") ||
    keywords.includes("agent-os") ||
    name.startsWith("@plaios/");
}

export function kindsFromKeywords(keywords: readonly string[]): InterfaceKind[] {
  const tokens = new Set(keywords.map((keyword) => keyword.toLowerCase()));
  const kinds: InterfaceKind[] = [];
  if (tokens.has("environment") || tokens.has("env")) kinds.push("env");
  if (tokens.has("system1")) kinds.push("system1");
  if ((tokens.has("system2") || tokens.has("ai")) && !tokens.has("orchestrator") && !tokens.has("action")) kinds.push("system2");
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
      const latest = isRecord(value["dist-tags"]) ? value["dist-tags"].latest : undefined;
      const version = typeof value.version === "string" ? value.version : latest;
      packages.push({
        name,
        version: typeof version === "string" ? version : "",
        description: typeof value.description === "string" ? value.description : undefined,
        keywords,
        updatedAt: isRecord(value.time) ? text(value.time.modified) : undefined,
      });
    }
    return packages;
  } catch (error) {
    throw new Error(`Registry is unreachable (${error instanceof Error ? error.message : String(error)})`);
  }
}

export async function listStorePackages(snapshot: RuntimeSnapshot): Promise<StorePackageDto[]> {
  const objects = await searchRegistry(snapshot.registry);
  const { instances, installedVersions } = installedPackages(snapshot);
  const resolved = await Promise.all(objects.flatMap((candidate) => {
    const installed = instances.has(candidate.name);
    if (!isStoreCatalogPackage(candidate.name, candidate.keywords, installed)) return [];
    return [resolveStorePackage(snapshot.registry, candidate, installedVersions, instances)];
  }));
  return resolved
    .filter((item): item is StorePackageDto => Boolean(item))
    .sort((left, right) => Number(right.installed) - Number(left.installed) || left.name.localeCompare(right.name));
}

export async function getStorePackage(snapshot: RuntimeSnapshot, name: string): Promise<StorePackageDetailDto> {
  const response = await fetch(new URL(`/${encodeURIComponent(name)}`, `${snapshot.registry}/`), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!response.ok) throw new Error(`Package ${name} was not found in the registry (${response.status})`);
  const detail = parsePackument(await response.json());
  const { instances, installedVersions } = installedPackages(snapshot);
  const installedVersion = installedVersions.get(name);
  return {
    ...detail,
    installedVersion,
    installed: instances.has(name),
    updateAvailable: isNewerVersion(detail.version, installedVersion),
    instances: instances.get(name) ?? 0,
  };
}

/** Reads the latest version's metadata, the README and the version history out of a registry packument. */
export function parsePackument(packument: unknown): PackumentDetail {
  if (!isRecord(packument) || typeof packument.name !== "string") throw new Error("Invalid registry response");
  const tags = isRecord(packument["dist-tags"]) ? packument["dist-tags"] : {};
  const versions = isRecord(packument.versions) ? packument.versions : {};
  const time = isRecord(packument.time) ? packument.time : {};
  const version = text(tags.latest) ?? Object.keys(versions).at(-1) ?? "";
  const latest = isRecord(versions[version]) ? versions[version] : {};
  const dist = isRecord(latest.dist) ? latest.dist : {};
  const keywords = strings(latest.keywords);
  const readme = text(packument.readme) ?? text(latest.readme);
  return {
    name: packument.name,
    version,
    description: text(latest.description) ?? text(packument.description),
    keywords,
    kinds: kindsFromKeywords(keywords),
    updatedAt: text(time[version]) ?? text(time.modified),
    // Verdaccio stores this placeholder when a tarball shipped no README.
    readme: readme && !readme.startsWith("ERROR: No README data found") ? readme : undefined,
    license: text(latest.license),
    homepage: webUrl(latest.homepage),
    repository: webUrl(isRecord(latest.repository) ? latest.repository.url : latest.repository),
    author: isRecord(latest.author) ? text(latest.author.name) : text(latest.author),
    createdAt: text(time.created),
    versions: Object.keys(versions)
      .map((item) => ({ version: item, date: text(time[item]) }))
      .sort((left, right) => (right.date ?? "").localeCompare(left.date ?? "")),
    dependencies: Object.keys(isRecord(latest.dependencies) ? latest.dependencies : {}),
    peerDependencies: Object.keys(isRecord(latest.peerDependencies) ? latest.peerDependencies : {}),
    unpackedSize: typeof dist.unpackedSize === "number" ? dist.unpackedSize : undefined,
    fileCount: typeof dist.fileCount === "number" ? dist.fileCount : undefined,
  };
}

function installedPackages(snapshot: RuntimeSnapshot) {
  const instances = new Map<string, number>();
  const installedVersions = new Map<string, string>();
  for (const component of snapshot.components) {
    instances.set(component.packageName, (instances.get(component.packageName) ?? 0) + 1);
    installedVersions.set(component.packageName, component.version);
  }
  return { instances, installedVersions };
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

/** Only http(s) links reach the page: `git+https://…/x.git` becomes `https://…/x`, anything else is dropped. */
function webUrl(value: unknown): string | undefined {
  const raw = text(value)?.replace(/^git\+/, "").replace(/\.git$/, "");
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
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
    kinds: kindsFromKeywords(candidate.keywords),
    updatedAt: candidate.updatedAt,
  };
}

function parseSemver(value: string): { numbers: [number, number, number]; prerelease: string } | undefined {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(value);
  if (!match) return undefined;
  return {
    numbers: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ?? "",
  };
}
