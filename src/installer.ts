import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { DynamicComponentConfig } from "./types.js";

export async function installConfiguredPackages(
  runtimeRoot: string,
  registry: string,
  components: readonly DynamicComponentConfig[],
): Promise<void> {
  await initializeRuntimeRoot(runtimeRoot);
  const packages = new Map<string, string | undefined>();
  for (const component of components) {
    const existing = packages.get(component.package);
    if (packages.has(component.package) && existing !== component.version) {
      throw new Error(`Package ${component.package} is configured with conflicting versions`);
    }
    packages.set(component.package, component.version);
  }
  for (const [packageName, version] of packages) {
    if (await isExactVersionInstalled(runtimeRoot, packageName, version)) {
      console.log(`[dynamic] ready ${packageName}@${version}`);
      continue;
    }
    const specifier = `${packageName}@${version ?? "latest"}`;
    console.log(`[dynamic] installing ${specifier} from ${registry}`);
    await run("pnpm", ["--dir", runtimeRoot, "add", "--save-exact", specifier, "--registry", registry]);
  }
}

export async function installRuntimePackage(
  runtimeRoot: string,
  registry: string,
  packageName: string,
  version = "latest",
): Promise<void> {
  assertPackageName(packageName);
  await initializeRuntimeRoot(runtimeRoot);
  await run("pnpm", [
    "--dir",
    runtimeRoot,
    "add",
    "--save-exact",
    `${packageName}@${version}`,
    "--registry",
    registry,
  ]);
}

export async function uninstallRuntimePackage(
  runtimeRoot: string,
  packageName: string,
): Promise<void> {
  assertPackageName(packageName);
  await initializeRuntimeRoot(runtimeRoot);
  await run("pnpm", ["--dir", runtimeRoot, "remove", packageName]);
}

export function assertPackageName(packageName: string): void {
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*|[a-z0-9][a-z0-9._-]*)$/i.test(packageName)) {
    throw new Error(`Invalid npm package name: ${packageName}`);
  }
}

export function installedPackageRoot(runtimeRoot: string, packageName: string): string {
  return join(runtimeRoot, "node_modules", ...packageName.split("/"));
}

async function initializeRuntimeRoot(runtimeRoot: string): Promise<void> {
  await mkdir(runtimeRoot, { recursive: true });
  const packagePath = join(runtimeRoot, "package.json");
  if (!(await exists(packagePath))) {
    await writeFile(packagePath, `${JSON.stringify({ name: "agent-os-runtime", private: true, type: "module" }, null, 2)}\n`, "utf8");
  }
  const workspacePath = join(runtimeRoot, "pnpm-workspace.yaml");
  if (!(await exists(workspacePath))) await writeFile(workspacePath, "packages: []\n", "utf8");
  // pnpm 11 fails the whole install when a dependency's build script is skipped (esbuild under
  // God's Eye View); plugins never need those scripts, so keep them skipped but only warn.
  const workspace = await readFile(workspacePath, "utf8");
  if (!/^strictDepBuilds:/m.test(workspace)) {
    await writeFile(workspacePath, `${workspace.replace(/\n?$/, "\n")}strictDepBuilds: false\n`, "utf8");
  }
}

async function isExactVersionInstalled(
  runtimeRoot: string,
  packageName: string,
  requestedVersion?: string,
): Promise<boolean> {
  const packagePath = join(installedPackageRoot(runtimeRoot, packageName), "package.json");
  try {
    const value = JSON.parse(await readFile(packagePath, "utf8")) as { version?: string };
    if (!requestedVersion || requestedVersion === "latest") return typeof value.version === "string";
    return value.version === requestedVersion;
  } catch {
    return false;
  }
}

export function run(command: string, args: readonly string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit", shell: false });
    child.once("error", (error: NodeJS.ErrnoException) => {
      // No global pnpm (e.g. started with npx): borrow one through npx.
      if (command === "pnpm" && error.code === "ENOENT") run("npx", ["--yes", "pnpm@10", ...args], cwd).then(resolve, reject);
      else reject(error);
    });
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}`));
    });
  });
}

async function exists(path: string): Promise<boolean> {
  try { await access(path); return true; } catch { return false; }
}
