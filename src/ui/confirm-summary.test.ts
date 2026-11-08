import { test } from "node:test";
import assert from "node:assert/strict";
import { confirmSummary } from "./confirm-summary.js";

const ASKING = 'Session 17 wants to commit. Say "confirm commit" to allow it once, or say deny.';

test("confirm summary: the last paragraph naming an asked phrase is shown", () => {
  const reply = `Nothing is waiting for approval now.\n\n${ASKING}\n\nPermission p21 can only be allowed once.`;
  assert.equal(confirmSummary(reply, ["commit"]), ASKING);
});

test("confirm summary: a phrase is found whatever its case", () => {
  const reply = `Earlier news.\n\nSay "Confirm Push" to push.`;
  assert.equal(confirmSummary(reply, ["push"]), 'Say "Confirm Push" to push.');
});

test("confirm summary: without an asked phrase the last paragraph is shown", () => {
  assert.equal(confirmSummary("First.\n\nLast.", ["push"]), "Last.");
});

test("confirm summary: an empty reply shows nothing", () => {
  assert.equal(confirmSummary("", ["push"]), "");
});
