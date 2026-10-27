import type { IncomingMessage } from "node:http";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createServer, type Plugin, type ViteDevServer } from "vite";

import { loadOrCreateConfig, resolveConfigPath } from "./config.js";
import { scheduleHostRestart, updateHostPackage } from "./host-settings.js";
import { installConfiguredPackages } from "./installer.js";
import { DynamicRuntime } from "./runtime.js";
import { getStorePackage, listStorePackages } from "./store-catalog.js";
import type { InterfaceKind } from "./types.js";
import { INTERFACE_KINDS, isRecord } from "./types.js";

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
    resolve: { dedupe: ["react", "react-dom", "@plaios/microfrontend"] },
    optimizeDeps: { include: ["react", "react-dom", "react/jsx-runtime", "@plaios/microfrontend"] },
    server: {
      host: config.server.host,
      port: config.server.port,
      strictPort: true,
      allowedHosts: true,
      // Plugin modules are served through /@fs/, so keep databases and secrets out of reach. The first four are Vite's defaults.
      fs: {
        strict: true,
        allow: [packageRoot, projectRoot, runtimeRoot],
        deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.agent-os/data/**", "*.{sqlite,sqlite3,db}", "*.{sqlite,db}-{wal,shm,journal}"],
      },
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
          if (request.method === "GET" && url.pathname === "/api/telemetry") {
            return json(response, 200, runtime.telemetry.snapshot());
          }
          if (request.method === "POST" && url.pathname === "/api/runtime/reload") {
            return json(response, 200, await runtime.reload());
          }
          if (request.method === "GET" && url.pathname === "/api/store") {
            return json(response, 200, await listStorePackages(runtime.snapshot()));
          }
          if (request.method === "GET" && url.pathname === "/api/store/package") {
            const name = url.searchParams.get("name");
            if (!name) throw new Error("Invalid Store package request");
            return json(response, 200, await getStorePackage(runtime.snapshot(), name));
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
          if (request.method === "POST" && url.pathname === "/api/store/update") {
            const body = await bodyJson(request) as { packageName?: unknown; version?: unknown };
            if (typeof body.packageName !== "string" || (body.version !== undefined && typeof body.version !== "string")) {
              throw new Error("Invalid Store update request");
            }
            const snapshot = await runtime.updatePackage(body.packageName, body.version);
            scheduleHostRestart();
            return json(response, 200, { ...snapshot, restarting: true });
          }
          if (request.method === "POST" && url.pathname === "/api/chat") {
            const body = await bodyJson(request) as { text?: unknown; sessionId?: unknown };
            if (typeof body.text !== "string" || !body.text.trim() || typeof body.sessionId !== "string") throw new Error("Invalid chat request");
            // Newline-delimited JSON: {delta} while the model streams, then {done, components} or {error}.
            response.statusCode = 200;
            response.setHeader("content-type", "application/x-ndjson; charset=utf-8");
            response.setHeader("cache-control", "no-store");
            const send = (event: unknown) => response.write(`${JSON.stringify(event)}\n`);
            try {
              const result = await runtime.chat(body.text.trim(), body.sessionId, (delta) => send({ delta }));
              send({ done: true, components: result.components });
            } catch (error) {
              send({ error: error instanceof Error ? error.message : String(error) });
            }
            return response.end();
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
          if (request.method === "GET" && url.pathname === "/api/settings") {
            return json(response, 200, await runtime.hostSettings());
          }
          if (request.method === "PUT" && url.pathname === "/api/settings") {
            const body = await bodyJson(request) as { registry?: unknown };
            if (typeof body.registry !== "string") throw new Error("Invalid settings request");
            return json(response, 200, await runtime.updateRegistry(body.registry));
          }
          if (request.method === "POST" && url.pathname === "/api/settings/update") {
            const body = await bodyJson(request) as { version?: unknown };
            if (body.version !== undefined && typeof body.version !== "string") throw new Error("Invalid update request");
            const result = await updateHostPackage({
              projectRoot: runtime.projectRoot,
              registry: runtime.snapshot().registry,
              version: body.version,
            });
            scheduleHostRestart();
            return json(response, 200, result);
          }
          if (request.method === "POST" && url.pathname === "/api/settings/swap") {
            const body = await bodyJson(request) as { kind?: unknown; packageName?: unknown; version?: unknown };
            if (typeof body.kind !== "string" || !INTERFACE_KINDS.includes(body.kind as InterfaceKind)) {
              throw new Error("Invalid swap kind");
            }
            if (typeof body.packageName !== "string" || (body.version !== undefined && typeof body.version !== "string")) {
              throw new Error("Invalid swap request");
            }
            const snapshot = await runtime.swapKind(body.kind as InterfaceKind, body.packageName, body.version);
            return json(response, 200, { ...snapshot, kind: body.kind, packageName: body.packageName, version: body.version ?? "latest" });
          }
          if (request.method === "POST" && url.pathname === "/api/settings/component") {
            const body = await bodyJson(request) as { instanceId?: unknown; enabled?: unknown };
            if (typeof body.instanceId !== "string" || typeof body.enabled !== "boolean") {
              throw new Error("Invalid component toggle request");
            }
            return json(response, 200, await runtime.setComponentEnabled(body.instanceId, body.enabled));
          }
          if (request.method === "DELETE" && url.pathname === "/api/settings/component") {
            const body = await bodyJson(request) as { instanceId?: unknown };
            if (typeof body.instanceId !== "string") throw new Error("Invalid component remove request");
            return json(response, 200, await runtime.removeComponent(body.instanceId));
          }
          return json(response, 404, { error: "Not found" });
        } catch (error) {
          return json(response, 400, { error: error instanceof Error ? error.message : String(error) });
        }
      });
    },
  };
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

let handlersInstalled = false;
function installSignalHandlers(handle: DynamicAppHandle): void {
  if (handlersInstalled) return;
  handlersInstalled = true;
  const shutdown = () => void handle.close().finally(() => process.exit());
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
