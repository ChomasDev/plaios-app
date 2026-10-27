import assert from "node:assert/strict";
import test from "node:test";

import { isNewerVersion, isStoreCatalogPackage, kindsFromKeywords, parsePackument } from "../src/store-catalog.js";

test("detects newer stable registry versions", () => {
  assert.equal(isNewerVersion("0.1.2", "0.1.0"), true);
  assert.equal(isNewerVersion("1.0.0", "0.99.99"), true);
  assert.equal(isNewerVersion("0.1.0", "0.1.2"), false);
  assert.equal(isNewerVersion("0.1.2", "0.1.2"), false);
  assert.equal(isNewerVersion("not-semver", "0.1.2"), false);
});

test("does not replace a stable install with a prerelease", () => {
  assert.equal(isNewerVersion("1.0.0-beta.1", "1.0.0"), false);
  assert.equal(isNewerVersion("1.0.0", "1.0.0-beta.1"), true);
  assert.equal(isNewerVersion("1.0.0-beta.2", "1.0.0-beta.1"), true);
});

test("lists Agent OS packages even without the capability keyword", () => {
  assert.equal(isStoreCatalogPackage("@agent-os/jev-orchestrator", [], false), true);
  assert.equal(isStoreCatalogPackage("@agent-os/jev-orhcestator", [], false), false);
  assert.equal(isStoreCatalogPackage("@agent-os/orchestrator-default", ["agent-os", "capability", "orchestrator"], false), true);
  assert.equal(isStoreCatalogPackage("@agent-os/app-dynamic", ["agent-os"], false), false);
  assert.equal(isStoreCatalogPackage("left-pad", ["utility"], false), false);
  assert.equal(isStoreCatalogPackage("left-pad", ["utility"], true), true);
});

test("maps registry keywords onto swappable interface kinds", () => {
  assert.deepEqual(kindsFromKeywords(["agent-os", "capability", "orchestrator", "ai"]), ["orchestrator"]);
  assert.deepEqual(kindsFromKeywords(["agent-os", "capability", "environment", "dotenv"]), ["env"]);
  assert.deepEqual(kindsFromKeywords(["agent-os", "capability", "ai", "codex"]), ["system2"]);
  assert.deepEqual(kindsFromKeywords(["agent-os", "agent", "loop"]), ["agent"]);
  assert.deepEqual(kindsFromKeywords(["agent-os", "capability", "action", "memory", "retrieval"]), ["action"]);
});

test("reads a package page from a registry packument", () => {
  const detail = parsePackument({
    name: "@agent-os/action-ssh",
    "dist-tags": { latest: "0.2.0" },
    readme: "# SSH",
    time: { created: "2026-01-01T00:00:00.000Z", "0.1.0": "2026-01-01T00:00:00.000Z", "0.2.0": "2026-02-01T00:00:00.000Z" },
    versions: {
      "0.2.0": { description: "SSH control", keywords: ["agent-os", "action"], license: "MIT", repository: { url: "git+https://github.com/x/y.git" }, homepage: "javascript:alert(1)", dependencies: { ssh2: "^1" }, dist: { unpackedSize: 2048 } },
      "0.1.0": {},
    },
  });
  assert.equal(detail.version, "0.2.0");
  assert.equal(detail.readme, "# SSH");
  assert.deepEqual(detail.kinds, ["action"]);
  assert.equal(detail.repository, "https://github.com/x/y");
  assert.equal(detail.homepage, undefined);
  assert.deepEqual(detail.versions.map((entry) => entry.version), ["0.2.0", "0.1.0"]);
  assert.deepEqual(detail.dependencies, ["ssh2"]);
  assert.equal(detail.updatedAt, "2026-02-01T00:00:00.000Z");
});

test("drops Verdaccio's missing-README placeholder", () => {
  assert.equal(parsePackument({ name: "x", readme: "ERROR: No README data found!", versions: { "1.0.0": {} } }).readme, undefined);
});
