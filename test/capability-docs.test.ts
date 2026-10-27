import assert from "node:assert/strict";
import test from "node:test";

import { CapabilityDocsCapability, type CapabilityDocsEntry } from "../src/capability-docs.js";

const entry: CapabilityDocsEntry = {
  packageName: "@plaios/demo",
  capability: {
    manifest: { id: "demo.search", version: "1.0.0", name: "search_demo", description: "Searches the demo.", inputSchema: { type: "object" } },
    docs: () => "Use it for demos.",
    uiComponents: () => [{ name: "DemoCard", description: "Shows a demo.", props: [{ name: "id", type: "string" }] }],
  },
  configFields: [
    { key: "apiKey", env: "DEMO_KEY", type: "secret", description: "API key" },
    { key: "limit", type: "number" },
  ],
  configValue: (key) => ({ apiKey: "sk-very-secret", limit: 5 })[key],
};

test("renders a capability's docs with config and chat components, never a secret", async () => {
  const result = await new CapabilityDocsCapability(() => [entry]).execute({ capabilityId: "demo.search" });
  assert.equal(result.success, true);
  const markdown = result.success ? result.data.markdown : "";
  assert.match(markdown, /Use it for demos\./);
  assert.match(markdown, /`apiKey` \(env DEMO_KEY\): set/);
  assert.match(markdown, /`limit`: 5/);
  assert.match(markdown, /`DemoCard\(id: string\)`/);
  assert.doesNotMatch(markdown, /sk-very-secret/);
});

test("lists the available ids for an unknown capability", async () => {
  const result = await new CapabilityDocsCapability(() => [entry]).execute({ capabilityId: "nope" });
  assert.equal(result.success, false);
  assert.match(result.success ? "" : result.error.message, /demo\.search/);
});
