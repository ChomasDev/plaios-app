import assert from "node:assert/strict";
import test from "node:test";

import { parsePackageManifest } from "../src/manifest.js";
import { DynamicRuntime } from "../src/runtime.js";

const manifest = (kind: string, uses: string) => parsePackageManifest(`
schemaVersion: 1
id: demo
name: Demo
version: 0.1.0
interfaces:
  - id: demo.x
    kind: ${kind}
${uses}
`).interfaces[0]!;

test("manifests published with kind `ai` load as system2", () => {
  const legacy = manifest("ai", "    required: [ai]");
  assert.equal(legacy.kind, "system2");
  assert.deepEqual(legacy.required, ["system2"]);
});

test("plugins receive System 1 and System 2 they declare, picked by instanceId", () => {
  const runtime = new DynamicRuntime(".", ".", "agent-os.yaml", { schemaVersion: 1, registry: "", server: { host: "", port: 0 }, components: [] } as never);
  const jev = { name: "jev" };
  const codex = { name: "codex" };
  const openrouter = { name: "openrouter" };
  const internals = runtime as unknown as {
    components: unknown[];
    componentOptions(manifestInterface: unknown, definition: unknown): Record<string, unknown>;
  };
  internals.components = [
    { definition: { instanceId: "system1:jev" }, descriptor: { kind: "system1" }, instance: jev },
    { definition: { instanceId: "ai:codex" }, descriptor: { kind: "system2" }, instance: codex },
    { definition: { instanceId: "ai:openrouter" }, descriptor: { kind: "system2" }, instance: openrouter },
  ];
  const plugin = manifest("action", "    required: [env, system2]\n    optional: [system1]");
  const plain = manifest("action", "    required: [env]");

  const options = internals.componentOptions(plugin, {});
  assert.equal(options.system1, jev);
  assert.equal(options.system2, codex);
  const picked = internals.componentOptions(plugin, { config: { system2Instance: "ai:openrouter" } });
  assert.equal(picked.system2, openrouter);
  assert.equal(internals.componentOptions(plain, {}).system2, undefined);
});
