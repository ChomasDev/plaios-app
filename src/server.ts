import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createRequire } from "node:module";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { createServer, type Plugin, type ViteDevServer } from "vite";

import { ChatTurns, type ChatEvent } from "./chat-turns.js";
import { CHAT_NAMESPACE, ConversationStore, applyChatEvent } from "./conversation-store.js";
import { loadOrCreateConfig, resolveConfigPath } from "./config.js";
import { HostLogs } from "./host-logs.js";
import { IMAGE_TYPES, UploadStore, agentInputFor } from "./uploads.js";
import { scheduleHostRestart, updateHostPackage } from "./host-settings.js";
import { installConfiguredPackages } from "./installer.js";
import { DynamicRuntime } from "./runtime.js";
import { getStorePackage, listStorePackages } from "./store-catalog.js";
import type { ChatTurnDto, ConversationDto, InterfaceKind, ModelKind } from "./types.js";
import { INTERFACE_KINDS, MODEL_KINDS, isRecord } from "./types.js";

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
  const logs = new HostLogs();
  logs.capture();
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
  const conversations = new ConversationStore(() => runtime.hostDatabase(CHAT_NAMESPACE));
  const uploads = new UploadStore(join(dirname(configPath), ".agent-os", "uploads"));
  await runtime.load();

  const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
  const webRoot = join(packageRoot, "web");
  const vite = await createServer({
    root: webRoot,
    appType: "spa",
    plugins: [react(), tailwindcss(), runtimeApi(runtime, logs, conversations, uploads)],
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
        allow: [packageRoot, projectRoot, runtimeRoot, dependencyRoot(packageRoot)],
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

function runtimeApi(runtime: DynamicRuntime, logs: HostLogs, conversations: ConversationStore, uploads: UploadStore): Plugin {
  const chatTurns = new ChatTurns();
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
          if (request.method === "GET" && url.pathname === "/api/logs") {
            return json(response, 200, logs.list());
          }
          if (request.method === "POST" && url.pathname === "/api/settings/restart") {
            scheduleHostRestart();
            return json(response, 200, { restarting: true });
          }
          if (request.method === "POST" && url.pathname === "/api/components/restart") {
            const body = await bodyJson(request) as { instanceIds?: unknown };
            if (!Array.isArray(body.instanceIds) || !body.instanceIds.length || !body.instanceIds.every((id) => typeof id === "string")) {
              throw new Error("Invalid restart request");
            }
            return json(response, 200, await runtime.restartComponents(body.instanceIds as string[]));
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
          if (request.method === "POST" && url.pathname === "/api/uploads") {
            const name = decodeURIComponent(String(request.headers["x-file-name"] ?? "file"));
            return json(response, 200, await uploads.save(request, name, String(request.headers["content-type"] ?? "")));
          }
          if (request.method === "GET" && url.pathname === "/api/uploads/file") {
            const upload = await uploads.get(url.searchParams.get("id") ?? "");
            if (!upload) return json(response, 404, { error: "Unknown file" });
            // Only images render inline; anything else downloads, so an uploaded page can never run in this origin.
            const inline = IMAGE_TYPES.has(upload.attachment.mediaType);
            response.statusCode = 200;
            response.setHeader("content-type", inline ? upload.attachment.mediaType : "application/octet-stream");
            response.setHeader("content-disposition", `${inline ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(upload.attachment.name)}`);
            response.setHeader("x-content-type-options", "nosniff");
            response.setHeader("cache-control", "private, max-age=31536000, immutable");
            uploads.open(upload).pipe(response);
            return;
          }
          if (request.method === "POST" && url.pathname === "/api/chat") {
            const body = await bodyJson(request) as { text?: unknown; sessionId?: unknown; turnId?: unknown; attachments?: unknown };
            const files = (await Promise.all((Array.isArray(body.attachments) ? body.attachments : []).map((id) => uploads.get(String(id))))).filter((upload) => upload !== undefined);
            if (typeof body.text !== "string" || (!body.text.trim() && files.length === 0) || typeof body.sessionId !== "string" || !/^[\w-]{1,100}$/.test(body.sessionId)) throw new Error("Invalid chat request");
            const text = body.text.trim();
            const sessionId = body.sessionId;
            const turnId = typeof body.turnId === "string" && body.turnId ? body.turnId : randomUUID();
            const { images, note } = await agentInputFor(files);
            const attachments = files.map(({ attachment }) => attachment);
            // The turn keeps running if the page goes away; GET /api/chat/turn follows it again.
            chatTurns.start(turnId, async (emit) => {
              const result = await runtime.chat(`${text || "See the attached files."}${note}`, sessionId, (delta) => emit({ delta }), (step) => emit({ step }), {
                attachments: images,
                // History and routing keep the words, not the inlined file contents.
                ...(note ? { originalText: `${text}${text ? " " : ""}[attached: ${attachments.map(({ name }) => name).join(", ")}]` } : {}),
              });
              emit({ done: true, components: result.components });
            });
            recordTurn(chatTurns, conversations, sessionId, { id: Number(turnId) || Date.now(), question: text, ...(attachments.length ? { attachments } : {}), components: [], streaming: true }, turnId);
            return followTurn(chatTurns, turnId, response);
          }
          if (request.method === "GET" && url.pathname === "/api/conversations") {
            return json(response, 200, await conversations.list());
          }
          if (request.method === "GET" && url.pathname === "/api/conversations/item") {
            const conversation = await conversations.get(url.searchParams.get("id") ?? "");
            return conversation ? json(response, 200, conversation) : json(response, 404, { error: "Unknown conversation" });
          }
          if (request.method === "POST" && url.pathname === "/api/conversations/visit") {
            const body = await bodyJson(request) as { id?: unknown };
            if (typeof body.id !== "string") throw new Error("Invalid visit request");
            await conversations.visit(body.id);
            return json(response, 200, { ok: true });
          }
          if (request.method === "POST" && url.pathname === "/api/conversations/import") {
            const body = await bodyJson(request) as { conversations?: unknown };
            if (!Array.isArray(body.conversations)) throw new Error("Invalid import request");
            return json(response, 200, { imported: await conversations.import(body.conversations as ConversationDto[]) });
          }
          if (request.method === "GET" && url.pathname === "/api/chat/turn") {
            const turnId = url.searchParams.get("id") ?? "";
            if (!followTurn(chatTurns, turnId, response)) return json(response, 404, { error: "Unknown chat turn" });
            return;
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
          if (request.method === "POST" && url.pathname === "/api/settings/active") {
            const body = await bodyJson(request) as { kind?: unknown; instanceId?: unknown };
            if (!MODEL_KINDS.includes(body.kind as ModelKind) || typeof body.instanceId !== "string") throw new Error("Invalid active model request");
            return json(response, 200, await runtime.setActiveModel(body.kind as ModelKind, body.instanceId));
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

/** Saves the turn as it starts, whenever a step settles, and when it ends, so every browser sees it and a crash loses little. */
function recordTurn(chatTurns: ChatTurns, conversations: ConversationStore, conversationId: string, initial: ChatTurnDto, turnId: string): void {
  let turn = initial;
  const save = () => void conversations.saveTurn(conversationId, turn).catch((error: unknown) => console.warn("[dynamic] Could not save conversation:", error instanceof Error ? error.message : error));
  save();
  chatTurns.follow(turnId, (event) => {
    turn = applyChatEvent(turn, event);
    const step = event.step as { status?: string } | undefined;
    if (event.done || event.error || (step && step.status !== "running")) save();
  });
}

/** Newline-delimited JSON: {step} and {delta} while the agent works, then {done, components} or {error}. */
function followTurn(chatTurns: ChatTurns, turnId: string, response: ServerResponse): boolean {
  let unsubscribe: (() => void) | undefined;
  const send = (event: ChatEvent) => {
    if (!response.headersSent) {
      response.statusCode = 200;
      response.setHeader("content-type", "application/x-ndjson; charset=utf-8");
      response.setHeader("cache-control", "no-store");
    }
    response.write(`${JSON.stringify(event)}\n`);
    if (event.done || event.error) { unsubscribe?.(); response.end(); }
  };
  unsubscribe = chatTurns.follow(turnId, send);
  if (!unsubscribe) return false;
  if (response.writableEnded) unsubscribe();
  else response.on("close", unsubscribe);
  return true;
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

/**
 * The node_modules folder the web UI's own dependencies (fonts, React) resolve from: the workspace
 * store in a repo checkout, the npx cache otherwise. Both sit outside packageRoot.
 */
function dependencyRoot(packageRoot: string): string {
  const resolved = createRequire(join(packageRoot, "package.json")).resolve("@fontsource-variable/noto-sans/package.json");
  const index = resolved.indexOf(`${sep}node_modules${sep}`);
  return index === -1 ? dirname(resolved) : resolved.slice(0, index + `${sep}node_modules`.length);
}
