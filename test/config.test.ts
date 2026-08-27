import assert from "node:assert/strict";
import test from "node:test";

import { parseDynamicAppConfig, starterConfig } from "../src/config.js";
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
