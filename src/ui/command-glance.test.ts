import { test } from "node:test";
import assert from "node:assert/strict";
import { commandGlance, isCutByGlance } from "./command-glance.js";

const SCRIPT = `cd /repo; set -e\n${"git ls-remote --exit-code origin refs/heads/feature\n".repeat(5)}`;

test("command glance: a short command shows as it is", () => {
  assert.equal(commandGlance("Bash: npm test"), "Bash: npm test");
});

test("command glance: a long script is put on one line and cut off with …", () => {
  assert.equal(commandGlance(SCRIPT), `${SCRIPT.replace(/\s+/g, " ").slice(0, 160)}…`);
});

test("command glance: a long script is cut", () => {
  assert.equal(isCutByGlance(SCRIPT), true);
});

test("command glance: a short command isn't cut", () => {
  assert.equal(isCutByGlance("Bash: npm test"), false);
});

test("command glance: a short command over several lines counts as cut", () => {
  assert.equal(isCutByGlance("Bash: cd /repo\nnpm test"), true);
});
