import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { versionedModuleUrl } from "../src/runtime.js";

test("package runtime imports are isolated by published version", async () => {
  const directory = await mkdtemp(join(tmpdir(), "agent-os-runtime-import-"));
  const entry = join(directory, "package.mjs");
  await writeFile(entry, "export const version = '0.1.0';\n", "utf8");
  const first = await import(versionedModuleUrl(entry, "0.1.0"));
  await writeFile(entry, "export const version = '0.1.1';\n", "utf8");
  const updated = await import(versionedModuleUrl(entry, "0.1.1"));

  assert.equal(first.version, "0.1.0");
  assert.equal(updated.version, "0.1.1");
  assert.notEqual(versionedModuleUrl(entry, "0.1.0"), versionedModuleUrl(entry, "0.1.1"));
});
