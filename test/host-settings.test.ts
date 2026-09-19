import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { assertHostVersion, ensureReleaseAgeExclude, latestPackageVersion, probeRegistry, readInstalledPackageVersion } from "../src/host-settings.js";

test("rejects unsafe host versions", () => {
  assert.equal(assertHostVersion("0.7.2"), "0.7.2");
  assert.throws(() => assertHostVersion("latest"), /Invalid host version/);
  assert.throws(() => assertHostVersion("../evil"), /Invalid host version/);
});

test("appends a freshly published version to pnpm release-age excludes", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-os-settings-"));
  await writeFile(
    join(root, "pnpm-workspace.yaml"),
    "minimumReleaseAgeExclude:\n  - 'agentos@0.7.0 || 0.7.1'\n",
  );
  const next = await ensureReleaseAgeExclude(root, "agentos", "0.7.2");
  assert.match(next ?? "", /agentos@0\.7\.0 \|\| 0\.7\.1 \|\| 0\.7\.2/);
});

test("reads runtime packages nested under the host install", async () => {
  const root = await mkdtemp(join(tmpdir(), "agent-os-nested-"));
  const nested = join(root, "node_modules", "agentos", "node_modules", "@agent-os", "app-dynamic");
  await mkdir(nested, { recursive: true });
  await writeFile(join(nested, "package.json"), JSON.stringify({ name: "@agent-os/app-dynamic", version: "0.7.2" }));
  assert.equal(await readInstalledPackageVersion(root, "@agent-os/app-dynamic"), "0.7.2");
});

test("does not fail settings when the registry URL is unreachable", async () => {
  assert.equal(await probeRegistry("http://127.0.0.1:1"), false);
  assert.equal(await latestPackageVersion("http://127.0.0.1:1", "agentos"), undefined);
  assert.equal(await latestPackageVersion("not-a-url", "agentos"), undefined);
});
