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
