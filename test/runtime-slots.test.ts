import assert from "node:assert/strict";
import test from "node:test";

import { buildRuntimeSlots, planKindReplacement, replaceKindComponents } from "../src/runtime-slots.js";
import type { DynamicManifestInterface } from "../src/types.js";

test("replaces every component of a kind in place", () => {
  const next = replaceKindComponents(
    [
      { package: "@agent-os/codex", interface: "codex.ai", instanceId: "ai:codex" },
      { package: "@agent-os/orchestrator-default", interface: "orchestrator-default.orchestrator", instanceId: "orchestrator:default" },
      { package: "@agent-os/telegram", interface: "telegram.output", instanceId: "output:telegram" },
    ],
    new Map([
      ["ai:codex", "system2"],
      ["orchestrator:default", "orchestrator"],
      ["output:telegram", "output"],
    ]),
    "orchestrator",
    [{ package: "@agent-os/jev-orchestrator", interface: "jev-orchestrator.orchestrator", instanceId: "orchestrator:default" }],
  );
  assert.deepEqual(next.map((item) => item.package), [
    "@agent-os/codex",
    "@agent-os/jev-orchestrator",
    "@agent-os/telegram",
  ]);
  assert.equal(next[1]?.instanceId, "orchestrator:default");
});

test("keeps instance ids and overlapping config when planning a swap", () => {
  const iface = {
    id: "jev-orchestrator.orchestrator",
    kind: "orchestrator",
    name: "Jev",
    entry: ".",
    export: ".",
    config: [{ key: "maxCapabilities", default: 50 }, { key: "apiKey" }],
  } as DynamicManifestInterface;
  const planned = planKindReplacement(
    [{
      kind: "orchestrator",
      instanceId: "orchestrator:default",
      packageName: "@agent-os/orchestrator-default",
      version: "0.1.2",
      interfaceId: "orchestrator-default.orchestrator",
      config: { maxCapabilities: 20, fastPath: true },
    }],
    [iface],
    "@agent-os/jev-orchestrator",
    "0.1.2",
  );
  assert.deepEqual(planned, [{
    package: "@agent-os/jev-orchestrator",
    version: "0.1.2",
    interface: "jev-orchestrator.orchestrator",
    instanceId: "orchestrator:default",
    config: { maxCapabilities: 20, fastPath: true },
  }]);
});

test("builds slots from mounted components and registry keywords", () => {
  const slots = buildRuntimeSlots(
    [{
      kind: "orchestrator",
      instanceId: "orchestrator:default",
      packageName: "@agent-os/orchestrator-default",
      version: "0.1.2",
      interfaceId: "orchestrator-default.orchestrator",
    }],
    [
      { name: "@agent-os/orchestrator-default", version: "0.1.2", keywords: ["orchestrator"] },
      { name: "@agent-os/jev-orchestrator", version: "0.1.2", description: "Jev router", keywords: ["orchestrator"] },
      { name: "@agent-os/codex", version: "0.1.2", keywords: ["ai"] },
    ],
  );
  const orchestrator = slots.find((slot) => slot.kind === "orchestrator");
  const ai = slots.find((slot) => slot.kind === "system2");
  assert.equal(orchestrator?.current[0]?.packageName, "@agent-os/orchestrator-default");
  assert.equal(orchestrator?.current[0]?.enabled, true);
  assert.deepEqual(orchestrator?.options.map((item) => item.packageName), [
    "@agent-os/jev-orchestrator",
    "@agent-os/orchestrator-default",
  ]);
  assert.equal(ai?.current.length, 0);
  assert.equal(ai?.options[0]?.packageName, "@agent-os/codex");
});
