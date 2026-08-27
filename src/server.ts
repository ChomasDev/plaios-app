import type { IncomingMessage } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createServer, type Plugin, type ViteDevServer } from "vite";

import { loadOrCreateConfig, resolveConfigPath } from "./config.js";
import { installConfiguredPackages } from "./installer.js";
import { DynamicRuntime } from "./runtime.js";
import type { RuntimeSnapshot, StorePackageDto } from "./types.js";

export interface StartDynamicAppOptions {
  currentDirectory?: string;
  configPath?: string;
  registry?: string;
  host?: string;
  port?: number;
  install?: boolean;
}

export interface DynamicAppHandle {
  url: string;
  configPath: string;
  close(): Promise<void>;
}

export async function startDynamicApp(options: StartDynamicAppOptions = {}): Promise<DynamicAppHandle> {
  const projectRoot = resolve(options.currentDirectory ?? process.cwd());
  const configPath = resolveConfigPath(projectRoot, options.configPath);
  const loaded = await loadOrCreateConfig(configPath);
  const config = loaded.config;
  if (options.registry) config.registry = new URL(options.registry).href.replace(/\/$/, "");
  if (options.host) config.server.host = options.host;
  if (options.port) config.server.port = options.port;
  if (loaded.created) console.log(`[dynamic] created starter config ${configPath}`);

  const runtimeRoot = join(dirname(configPath), ".agent-os", "runtime");
  if (options.install ?? true) {
    await installConfiguredPackages(runtimeRoot, config.registry, config.components);
  }
  const runtime = new DynamicRuntime(projectRoot, runtimeRoot, configPath, config);
  await runtime.load();

  const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
  const webRoot = join(packageRoot, "web");
  const vite = await createServer({
    root: webRoot,
    appType: "spa",
    plugins: [react(), tailwindcss(), runtimeApi(runtime)],
    resolve: { dedupe: ["react", "react-dom", "@agent-os/microfrontend"] },
    optimizeDeps: { include: ["react", "react-dom", "react/jsx-runtime", "@agent-os/microfrontend"] },
    server: {
      host: config.server.host,
      port: config.server.port,
      strictPort: true,
      allowedHosts: true,
      fs: { strict: true, allow: [packageRoot, projectRoot, runtimeRoot] },
    },
  });
  await vite.listen();
  vite.printUrls();
  const displayHost = config.server.host === "0.0.0.0" ? "localhost" : config.server.host;
  const handle: DynamicAppHandle = {
    url: `http://${displayHost}:${config.server.port}`,
    configPath,
    async close() {
      await vite.close();
      await runtime.close();
    },
  };
  installSignalHandlers(handle);
  return handle;
}

function runtimeApi(runtime: DynamicRuntime): Plugin {
  return {
    name: "agent-os-dynamic-runtime-api",
    configureServer(server) {
      server.middlewares.use(async (request, response, next) => {
        const url = new URL(request.url ?? "/", "http://agent-os.local");
        if (!url.pathname.startsWith("/api/")) return next();
        try {
          if (request.method === "GET" && url.pathname === "/api/health") {
            return json(response, 200, { status: "ok" });
          }
          if (request.method === "GET" && url.pathname === "/api/runtime") {
            return json(response, 200, runtime.snapshot());
          }
          if (request.method === "GET" && url.pathname === "/api/store") {
            return json(response, 200, await listStorePackages(runtime.snapshot()));
          }
          if (request.method === "POST" && url.pathname === "/api/store/install") {
            const body = await bodyJson(request) as { packageName?: unknown; version?: unknown };
            if (typeof body.packageName !== "string" || (body.version !== undefined && typeof body.version !== "string")) {
              throw new Error("Invalid Store install request");
            }
            return json(response, 200, await runtime.installPackage(body.packageName, body.version));
          }
          if (request.method === "POST" && url.pathname === "/api/store/uninstall") {
            const body = await bodyJson(request) as { packageName?: unknown };
            if (typeof body.packageName !== "string") throw new Error("Invalid Store uninstall request");
            return json(response, 200, await runtime.uninstallPackage(body.packageName));
          }
          const dataMatch = /^\/api\/components\/([^/]+)\/data$/.exec(url.pathname);
          if (request.method === "GET" && dataMatch) {
            return json(response, 200, await runtime.bridgeData(decodeURIComponent(dataMatch[1]!)));
          }
          const actionMatch = /^\/api\/components\/([^/]+)\/action$/.exec(url.pathname);
          if (request.method === "POST" && actionMatch) {
            const body = await bodyJson(request) as { path?: unknown; args?: unknown };
            if (typeof body.path !== "string" || !Array.isArray(body.args)) throw new Error("Invalid component action request");
            return json(response, 200, await runtime.callAction(decodeURIComponent(actionMatch[1]!), body.path, body.args));
          }
          if (request.method === "PUT" && url.pathname === "/api/configuration") {
            const body = await bodyJson(request) as { instanceId?: unknown; config?: unknown };
            if (typeof body.instanceId !== "string" || !isRecord(body.config)) throw new Error("Invalid configuration request");
            return json(response, 200, await runtime.updateConfig(body.instanceId, body.config));
          }
          return json(response, 404, { error: "Not found" });
        } catch (error) {
          return json(response, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
}

async function listStorePackages(snapshot: RuntimeSnapshot): Promise<StorePackageDto[]> {
  const endpoint = new URL("/-/v1/search", `${snapshot.registry}/`);
  // An empty query keeps local Verdaccio catalogs fast and avoids an uplink search.
  endpoint.searchParams.set("text", "");
  endpoint.searchParams.set("size", "250");
  const response = await fetch(endpoint, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Registry search failed (${response.status})`);
  const body = await response.json() as { objects?: unknown };
  const objects = Array.isArray(body.objects) ? body.objects : [];
  const instances = new Map<string, number>();
  for (const component of snapshot.components) {
    instances.set(component.packageName, (instances.get(component.packageName) ?? 0) + 1);
  }
  const candidates = objects.flatMap((entry): Array<{
    name: string;
    version?: string;
    description?: string;
    keywords: string[];
  }> => {
    if (!isRecord(entry) || !isRecord(entry.package)) return [];
    const value = entry.package;
    if (typeof value.name !== "string") return [];
    const keywords = Array.isArray(value.keywords)
      ? value.keywords.filter((keyword): keyword is string => typeof keyword === "string")
      : [];
    const installed = instances.has(value.name);
    if (!installed && !keywords.includes("capability")) return [];
    return [{
      name: value.name,
      version: typeof value.version === "string" ? value.version : undefined,
      description: typeof value.description === "string" ? value.description : undefined,
      keywords,
    }];
  });
  const resolved = await Promise.all(candidates.map(async (candidate): Promise<StorePackageDto | undefined> => {
    const version = candidate.version ?? await latestPackageVersion(snapshot.registry, candidate.name);
    if (!version) return undefined;
    return {
      ...candidate,
      version,
      installed: instances.has(candidate.name),
      instances: instances.get(candidate.name) ?? 0,
    };
  }));
  return resolved.filter((item): item is StorePackageDto => Boolean(item))
    .sort((left, right) => Number(right.installed) - Number(left.installed) || left.name.localeCompare(right.name));
}

async function latestPackageVersion(registry: string, packageName: string): Promise<string | undefined> {
  const response = await fetch(new URL(`/${encodeURIComponent(packageName)}`, `${registry}/`), { headers: { accept: "application/json" } });
  if (!response.ok) return undefined;
  const metadata = await response.json() as unknown;
  if (!isRecord(metadata) || !isRecord(metadata["dist-tags"])) return undefined;
  const latest = metadata["dist-tags"].latest;
  return typeof latest === "string" ? latest : undefined;
}

function bodyJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolveBody, reject) => {
    let source = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => {
      source += chunk;
      if (source.length > 1_000_000) reject(new Error("Request body is too large"));
    });
    request.on("end", () => {
      try { resolveBody(source ? JSON.parse(source) : {}); } catch { reject(new Error("Request body must be JSON")); }
    });
    request.on("error", reject);
  });
}

function json(response: { statusCode: number; setHeader(name: string, value: string): void; end(value: string): void }, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.end(JSON.stringify(value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

let handlersInstalled = false;
function installSignalHandlers(handle: DynamicAppHandle): void {
  if (handlersInstalled) return;
  handlersInstalled = true;
  const shutdown = () => void handle.close().finally(() => process.exit());
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
