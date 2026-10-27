import assert from "node:assert/strict";
import test from "node:test";

import { parseDynamicAppConfig, serializeDynamicAppConfig, starterConfig } from "../src/config.js";
import { parseStartArguments } from "../src/cli.js";

test("parses dynamic component instances and fills server defaults", () => {
  const config = parseDynamicAppConfig(`
schemaVersion: 1
registry: http://localhost:4873
components:
  - package: "@agent-os/sqlite"
    interface: sqlite.database
    config:
      databasePath: ":memory:"
`);
  assert.equal(config.server.port, 3100);
  assert.equal(config.components[0]?.instanceId, "sqlite.database:1");
  assert.equal(config.components[0]?.config?.databasePath, ":memory:");
});

test("parses disabled components and omits enabled when serializing the default", () => {
  const config = parseDynamicAppConfig(`
schemaVersion: 1
registry: http://localhost:4873
components:
  - { package: telegram, interface: telegram.input, instanceId: input:telegram, enabled: false }
  - { package: telegram, interface: telegram.output, instanceId: output:telegram }
`);
  assert.equal(config.components[0]?.enabled, false);
  assert.equal(config.components[1]?.enabled, undefined);
  const yaml = serializeDynamicAppConfig(config);
  assert.match(yaml, /enabled: false/);
  assert.equal((yaml.match(/enabled:/g) ?? []).length, 1);
});

test("rejects duplicate instances and unsafe package names", () => {
  const duplicate = `
schemaVersion: 1
registry: http://localhost:4873
components:
  - { package: one, interface: one.input, instanceId: same }
  - { package: two, interface: two.output, instanceId: same }
`;
  assert.throws(() => parseDynamicAppConfig(duplicate), /Duplicate component/);
  assert.throws(() => parseDynamicAppConfig(`
schemaVersion: 1
registry: http://localhost:4873
components:
  - { package: "bad --flag", interface: bad.input }
`), /Invalid npm package name/);
});

test("ships a useful starter graph and parses start overrides", () => {
  assert.deepEqual(starterConfig().components.map((item) => item.interface), [
    "sqlite.database",
    "telegram.input",
    "telegram.output",
  ]);
  assert.deepEqual(starterConfig().components[1]?.config, {});
  assert.deepEqual(parseStartArguments(["--port", "3200", "--host", "127.0.0.1", "--no-install"]), {
    help: false,
    port: 3200,
    host: "127.0.0.1",
    install: false,
  });
});

test("moves components of the misspelled jev orchestrator package to the renamed one", () => {
  const config = parseDynamicAppConfig(`
schemaVersion: 1
registry: http://localhost:4873
components:
  - package: "@agent-os/jev-orhcestator"
    version: 0.1.9
    interface: jev-orhcestator.orchestrator
    instanceId: orchestrator:default
    config: { mode: fast }
`);
  assert.deepEqual(config.components[0], {
    package: "@agent-os/jev-orchestrator",
    version: "latest",
    interface: "jev-orchestrator.orchestrator",
    instanceId: "orchestrator:default",
    enabled: undefined,
    config: { mode: "fast" },
  });
});
