import assert from "node:assert/strict";
import test from "node:test";

import { parsePackageManifest } from "../src/manifest.js";

test("parses independently swappable runtime and web exports", () => {
  const manifest = parsePackageManifest(`
schemaVersion: 1
id: telegram
name: Telegram
version: 0.1.0
interfaces:
  - id: telegram.input
    kind: input
    name: TelegramAdapter
    entry: .
    className: TelegramAdapter
    web:
      entry: ./web/input
      export: default
      styles: ./web/styles.css
`);
  assert.equal(manifest.interfaces[0]?.className, "TelegramAdapter");
  assert.equal(manifest.interfaces[0]?.web?.entry, "./web/input");
});

test("rejects unknown interface kinds", () => {
  assert.throws(() => parsePackageManifest(`
schemaVersion: 1
id: bad
name: Bad
version: 1.0.0
interfaces:
  - { id: bad.any, kind: anything }
`), /Invalid interface kind/);
});

test("assumes the conventional web entry when an interface declares none", () => {
  const manifest = parsePackageManifest(`
schemaVersion: 1
id: demo
name: Demo
version: 1.0.0
interfaces:
  - id: demo.action
    kind: action
`);
  assert.deepEqual(manifest.interfaces[0]?.web, { entry: "./web/action", export: "default", styles: "./web/styles.css", conventional: true });
});
