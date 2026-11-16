import { test } from "node:test";
import assert from "node:assert/strict";
import { isSpokenApproval, readSpokenApproval } from "./spoken-approval.js";

test("spoken approval: a plain allow allows once", () => {
  assert.deepEqual(readSpokenApproval("Allow."), { decision: "once" });
});

test("spoken approval: yes allows once", () => {
  assert.deepEqual(readSpokenApproval("Yes, please."), { decision: "once" });
});

test("spoken approval: a plain confirm allows once", () => {
  assert.deepEqual(readSpokenApproval("confirm"), { decision: "once" });
});

test("spoken approval: confirm always allows always", () => {
  assert.deepEqual(readSpokenApproval("Confirm always."), { decision: "always" });
});

test("spoken approval: a misheard hello before confirm is left out", () => {
  assert.deepEqual(readSpokenApproval("Hello. Hello. Confirm."), { decision: "once" });
});

test("spoken approval: hello alone is no approval", () => {
  assert.equal(isSpokenApproval("Hello."), false);
});

test("spoken approval: allow always allows always", () => {
  assert.deepEqual(readSpokenApproval("Allow always"), { decision: "always" });
});

test("spoken approval: always allow allows always", () => {
  assert.deepEqual(readSpokenApproval("Always allow."), { decision: "always" });
});

test("spoken approval: no denies", () => {
  assert.deepEqual(readSpokenApproval("No."), { decision: "deny" });
});

test("spoken approval: allow with a verb names what it allows", () => {
  assert.deepEqual(readSpokenApproval("Allow commit."), { decision: "once", verb: "commit" });
});

test("spoken approval: confirm with a verb names what it allows", () => {
  assert.deepEqual(readSpokenApproval("Okay, confirm push"), { decision: "once", verb: "push" });
});

test("spoken approval: allow edits always allows edits always", () => {
  assert.deepEqual(readSpokenApproval("allow edits always"), { decision: "always", verb: "edits" });
});

test("spoken approval: a longer sentence is not an approval", () => {
  assert.equal(isSpokenApproval("Allow commit and then fix the footer"), false);
});

test("spoken approval: a negation is not an approval", () => {
  assert.equal(isSpokenApproval("Don't allow push"), false);
});

test("spoken approval: reading a message that is not an approval throws", () => {
  assert.throws(() => readSpokenApproval("Run the tests"));
});
