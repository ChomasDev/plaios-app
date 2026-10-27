# @plaios/app-dynamic

> Part of [PLAIOS](https://github.com/ChomasDev/plaios). This repo is mounted as the `app-dynamic/` submodule of plaios and builds inside its pnpm workspace (it depends on `@plaios/core` and `@plaios/microfrontend` via `workspace:*`). Clone plaios with `--recursive` to work on it.

The dynamic PLAIOS runtime host. It installs configured capability packages from an npm-compatible registry, loads runtime interfaces and React microfrontends from their manifests, and provides a swappable local control plane.

When the installed graph contains input, output, memory, orchestrator, and agent interfaces, the host also starts the message runtime. Dual-interface packages share their runtime instance, allowing one HTTP adapter to correlate each input request with its matching output response.

## Start

From an plaios checkout:

```bash
pnpm plaios start
```

Directly from the registry:

```bash
npx --registry http://localhost:4873 plaios start
```

The direct package binary is also available:

```bash
pnpm dlx @plaios/app-dynamic
```

If `plaios.yaml` does not exist, the CLI creates a starter graph with SQLite plus Telegram input/output surfaces. Packages are installed into `.agent-os/runtime`; application dependencies remain separate from the capability graph.

## Capability Store

The full-width control plane includes a built-in Store backed by the configured npm registry. Installing a package discovers every interface in its `agent-os.package.yaml`, creates component instances with manifest defaults, persists them to `plaios.yaml`, and loads the runtime and microfrontends without restarting. Uninstall closes the package instances, removes their configuration, and removes the dependency from the isolated runtime.

Packages whose required settings are not configured remain visible and editable. Their failure is isolated to the affected instance instead of taking down the host.

## Environment and composition

Manifest configuration is resolved in this order: an explicit value in `plaios.yaml`, the manifest's `env` binding through the installed environment adapter, then the manifest default. Secret environment values are only passed to runtime constructors and are never copied into the YAML file or runtime snapshot.

Components are instantiated by dependency order rather than sidebar order. Environment, AI, and discovery providers are available before agents and orchestrators; the host injects live `env`, `model`, and `capabilityDiscovery` objects where required. Action capabilities are registered with the active discovery provider after the graph loads.

## Configuration

```yaml
schemaVersion: 1
registry: http://localhost:4873
server:
  host: 0.0.0.0
  port: 3100
components:
  - package: "@plaios/sqlite"
    version: latest
    interface: sqlite.database
    instanceId: database:main
    config:
      databasePath: .agent-os/data/agent-os.sqlite
  - package: "@plaios/telegram"
    version: latest
    interface: telegram.input
    instanceId: input:telegram
    config:
      botToken: configure-me
      chatId: configure-me
```

Each component is an independently configurable interface instance. A package can provide any combination of input, output, AI, memory, database, agent, orchestrator, discovery, action, or environment interfaces.

## Runtime behavior

At startup, AppDynamic:

1. Parses and validates `plaios.yaml`.
2. Deduplicates packages and rejects conflicting versions.
3. Installs missing packages from the configured registry with pnpm.
4. Reads each package's `agent-os.package.yaml`.
5. Dynamically imports and instantiates the selected runtime export.
6. Resolves the interface-owned React microfrontend and CSS export.
7. Starts the pluggable message pipeline when its required interfaces are present.
8. Starts the local control plane and exposes every instance in the component switcher.

Microfrontends are loaded through Vite at runtime, so installing another published capability does not require rebuilding AppDynamic.

## Management bridge

Runtime classes can expose one of these optional methods:

```ts
microfrontendData(): unknown
webData(): unknown
```

Plain values are sent to the browser. Functions explicitly returned on plain objects become same-origin RPC functions; class prototypes are never reflected. This is how the SQLite package exposes its four approved management actions without shipping `node:sqlite` or private helpers into the browser.

Configuration edits call the local runtime API, update `plaios.yaml`, close the previous instance when supported, and instantiate its replacement.

## Options

```text
plaios start --config ./plaios.yaml
              --registry http://localhost:4873
              --host 0.0.0.0
              --port 3100
              --no-install
```
