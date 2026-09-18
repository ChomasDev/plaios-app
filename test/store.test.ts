import assert from "node:assert/strict";
import test from "node:test";

import { isNewerVersion } from "../src/server.js";

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
