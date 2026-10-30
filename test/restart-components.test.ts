import assert from "node:assert/strict";
import test from "node:test";

import { DynamicRuntime } from "../src/runtime.js";

interface Loaded { definition: { instanceId: string }; descriptor: { instanceId: string; kind: string }; instance?: unknown }

function setup() {
  const runtime = new DynamicRuntime(".", ".", "agent-os.yaml", { schemaVersion: 1, registry: "", server: { host: "", port: 0 }, components: [] } as never);
  const closed: string[] = [];
  const loaded: string[] = [];
  const object = (name: string) => ({ name, close: async () => { closed.push(name); } });
  const cron = object("cron");
  const entry = (instanceId: string, kind: string, instance: unknown): Loaded => ({ definition: { instanceId }, descriptor: { instanceId, kind }, instance });
  const internals = runtime as unknown as {
    components: Loaded[];
    loadComponent(definition: { instanceId: string }): Promise<Loaded>;
    registerActionCapabilities(): Promise<void>;
    startAgentRuntime(): void;
    reload(): Promise<unknown>;
  };
  internals.components = [entry("memory:sqlite", "memory", object("memory")), entry("input:cronjob", "input", cron), entry("action:cronjob", "action", cron), entry("action:ssh", "action", object("ssh"))];
  internals.loadComponent = async (definition) => { loaded.push(definition.instanceId); return entry(definition.instanceId, "action", { name: `new ${definition.instanceId}` }); };
  internals.registerActionCapabilities = async () => undefined;
  internals.startAgentRuntime = () => undefined;
  let reloaded = false;
  internals.reload = async () => { reloaded = true; return undefined; };
  return { runtime, internals, closed, loaded, wasReloaded: () => reloaded };
}

test("restarts one action together with the interfaces sharing its object, and nothing else", async () => {
  const { runtime, internals, closed, loaded, wasReloaded } = setup();
  const memory = internals.components[0]!.instance;
  await runtime.restartComponents(["action:cronjob"]);
  assert.deepEqual(closed, ["cron"]);
  assert.deepEqual(loaded, ["input:cronjob", "action:cronjob"]);
  assert.equal(internals.components[0]!.instance, memory);
  assert.deepEqual(internals.components.map(({ descriptor }) => descriptor.instanceId), ["memory:sqlite", "input:cronjob", "action:cronjob", "action:ssh"]);
  assert.equal(wasReloaded(), false);
});

test("a core part reloads the whole runtime", async () => {
  const { runtime, closed, wasReloaded } = setup();
  await runtime.restartComponents(["memory:sqlite"]);
  assert.equal(wasReloaded(), true);
  assert.deepEqual(closed, []);
});
