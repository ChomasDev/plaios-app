import assert from "node:assert/strict";
import test from "node:test";

import { isNewerVersion, isStoreCatalogPackage, kindsFromKeywords } from "../src/store-catalog.js";

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
  assert.equal(isStoreCatalogPackage("@agent-os/jev-orhcestator", [], false), true);
  assert.equal(isStoreCatalogPackage("@agent-os/orchestrator-default", ["agent-os", "capability", "orchestrator"], false), true);
  assert.equal(isStoreCatalogPackage("@agent-os/app-dynamic", ["agent-os"], false), false);
  assert.equal(isStoreCatalogPackage("left-pad", ["utility"], false), false);
  assert.equal(isStoreCatalogPackage("left-pad", ["utility"], true), true);
});

test("maps registry keywords onto swappable interface kinds", () => {
  assert.deepEqual(kindsFromKeywords(["agent-os", "capability", "orchestrator", "ai"]), ["orchestrator"]);
  assert.deepEqual(kindsFromKeywords(["agent-os", "capability", "environment", "dotenv"]), ["env"]);
  assert.deepEqual(kindsFromKeywords(["agent-os", "capability", "ai", "codex"]), ["ai"]);
  assert.deepEqual(kindsFromKeywords(["agent-os", "agent", "loop"]), ["agent"]);
  assert.deepEqual(kindsFromKeywords(["agent-os", "capability", "action", "memory", "retrieval"]), ["action"]);
});
