import { test } from "node:test";
import assert from "node:assert/strict";
import { canCompare, defaultComparison } from "./branch-defaults.js";

test("branch defaults: the current branch goes into main", () => {
  const list = { current: "login", branches: ["develop", "login", "main"] };
  assert.deepEqual(defaultComparison(list), { base: "main", head: "login" });
});

test("branch defaults: without main, master is the base", () => {
  const list = { current: "login", branches: ["login", "master"] };
  assert.equal(defaultComparison(list).base, "master");
});

test("branch defaults: on main itself, the base is another usual one", () => {
  const list = { current: "main", branches: ["main", "origin/main"] };
  assert.equal(defaultComparison(list).base, "origin/main");
});

test("branch defaults: with no usual base, the first other branch is the base", () => {
  const list = { current: "b", branches: ["a", "b"] };
  assert.equal(defaultComparison(list).base, "a");
});

test("branch defaults: a detached HEAD compares the first branch", () => {
  const list = { current: "", branches: ["feature", "main"] };
  assert.equal(defaultComparison(list).head, "feature");
});

test("branch defaults: one branch can't be compared", () => {
  assert.equal(canCompare({ current: "main", branches: ["main"] }), false);
});

test("branch defaults: asking for a comparison of one branch throws", () => {
  assert.throws(() => defaultComparison({ current: "main", branches: ["main"] }), /only one branch/);
});
