import { spawn } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";

import type { HostSettingsDto, HostUpdateResult } from "./types.js";

export type { HostSettingsDto, HostUpdateResult };

const HOST_PACKAGE = "agentos";
const RUNTIME_PACKAGES = [
  "@agent-os/app-dynamic",
  "@agent-os/package-manager",
  "@agent-os/microfrontend",
] as const;
const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function assertHostVersion(version: string): string {
  if (!VERSION_PATTERN.test(version)) throw new Error(`Invalid host version: ${version}`);
  return version;
}

export async function readHostSettings(options: {
  projectRoot: string;
  configPath: string;
  registry: string;
  server: { host: string; port: number };
}): Promise<HostSettingsDto> {
  const current =
    (await readPackageVersion(join(options.projectRoot, "node_modules", HOST_PACKAGE, "package.json"))) ??
    (await readDeclaredHostVersion(join(options.projectRoot, "package.json"))) ??
    "unknown";
  const latest = await latestPackageVersion(options.registry, HOST_PACKAGE);
  const runtimePackages: HostSettingsDto["runtimePackages"] = [];
  for (const name of RUNTIME_PACKAGES) {
    const version = await readInstalledPackageVersion(options.projectRoot, name);
    if (version) runtimePackages.push({ name, current: version });
  }
  return {
    configPath: options.configPath,
    registry: options.registry,
    server: options.server,
    host: {
      packageName: HOST_PACKAGE,
      current,
      latest,
      updateAvailable: Boolean(latest && latest !== current),
    },
    runtimePackages,
  };
}

export async function updateHostPackage(options: {
  projectRoot: string;
  registry: string;
  version?: string;
}): Promise<HostUpdateResult> {
  const version = assertHostVersion(
    options.version && options.version !== "latest"
      ? options.version
      : (await latestPackageVersion(options.registry, HOST_PACKAGE)) ?? "",
  );
  await ensureReleaseAgeExclude(options.projectRoot, HOST_PACKAGE, version);
  await run("pnpm", ["add", `${HOST_PACKAGE}@${version}`, "--registry", options.registry], options.projectRoot);
  return { version, restarting: true };
}

export function scheduleHostRestart(): void {
  setTimeout(() => process.exit(1), 400);
}

async function latestPackageVersion(registry: string, packageName: string): Promise<string | undefined> {
  const response = await fetch(new URL(`/${encodeURIComponent(packageName)}`, `${registry}/`), {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return undefined;
  const metadata = await response.json() as { "dist-tags"?: { latest?: unknown } };
  return typeof metadata["dist-tags"]?.latest === "string" ? metadata["dist-tags"].latest : undefined;
}

export async function readInstalledPackageVersion(projectRoot: string, packageName: string): Promise<string | undefined> {
  const candidates = [
    join(projectRoot, "node_modules", packageName, "package.json"),
    join(projectRoot, "node_modules", HOST_PACKAGE, "node_modules", packageName, "package.json"),
  ];
  for (const path of candidates) {
    const version = await readPackageVersion(path);
    if (version) return version;
  }
  const resolvers = [
    join(projectRoot, "package.json"),
    join(projectRoot, "node_modules", HOST_PACKAGE, "package.json"),
    import.meta.url,
  ];
  for (const from of resolvers) {
    try {
      const resolved = createRequire(from).resolve(`${packageName}/package.json`);
      const version = await readPackageVersion(resolved);
      if (version) return version;
    } catch {
      /* package is not visible from this module graph */
    }
  }
  return undefined;
}

async function readPackageVersion(path: string): Promise<string | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as { version?: unknown };
    return typeof value.version === "string" ? value.version : undefined;
  } catch {
    return undefined;
  }
}

async function readDeclaredHostVersion(path: string): Promise<string | undefined> {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as { dependencies?: Record<string, string> };
    const declared = value.dependencies?.[HOST_PACKAGE];
    return declared?.replace(/^[^\d]*/, "") || undefined;
  } catch {
    return undefined;
  }
}

export async function ensureReleaseAgeExclude(root: string, packageName: string, version: string): Promise<string | undefined> {
  const path = join(root, "pnpm-workspace.yaml");
  let source: string;
  try {
    source = await readFile(path, "utf8");
  } catch {
    return undefined;
  }
  if (source.includes(`${packageName}@`) && source.includes(version)) return source;
  const linePattern = new RegExp(`(^\\s*-\\s*'${escapeRegExp(packageName)}@)([^']*)'`, "m");
  const next = linePattern.test(source)
    ? source.replace(linePattern, (_, prefix: string, versions: string) => `${prefix}${versions} || ${version}'`)
    : source.includes("minimumReleaseAgeExclude:")
      ? source.replace("minimumReleaseAgeExclude:", `minimumReleaseAgeExclude:\n  - '${packageName}@${version}'`)
      : `${source.trimEnd()}\nminimumReleaseAgeExclude:\n  - '${packageName}@${version}'\n`;
  await writeFile(path, next);
  return next;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function run(command: string, args: readonly string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: false });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`));
    });
  });
}
