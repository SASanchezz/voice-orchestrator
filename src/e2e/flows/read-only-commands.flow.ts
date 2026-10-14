import { test } from "node:test";
import assert from "node:assert/strict";
import { app } from "../support/harness.js";
import { countSince, heardTimes, mark } from "../support/helpers.js";

const { permissions, workers } = app;

test("a worker's read-only commands run without asking, even in ask mode", async () => {
  const i = mark();
  permissions.policy.setMode("ask");
  workers.intake.run("dbadmin", "run: git status --short && git log --oneline -3 | cat; ls deploy/ 2>/dev/null || pwd");
  await heardTimes(/^dbadmin session \d+ done: /, 1, i);
  assert.equal(countSince(i, /wants approval/), 0);
});
