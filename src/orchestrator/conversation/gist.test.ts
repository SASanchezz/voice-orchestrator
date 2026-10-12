import { test } from "node:test";
import assert from "node:assert/strict";
import { spokenGist, taskHeadline } from "./gist.js";

test("a short task is spoken as it was given", () => {
  assert.equal(spokenGist("resend countdown on sign-up"), "resend countdown on sign-up");
});

test("polite openers are dropped", () => {
  assert.equal(spokenGist("Can you please fix the login redirect"), "fix the login redirect");
});

test("only the first sentence is used", () => {
  assert.equal(spokenGist("Add bulk delete for users. Then run the tests and commit."), "Add bulk delete for users");
});

test("only the first line is used", () => {
  assert.equal(spokenGist("Redesign the verify page\nUse the new colors"), "Redesign the verify page");
});

test("a long task is cut to eight words", () => {
  assert.equal(
    spokenGist("add a countdown to the resend button on the sign-up page"),
    "add a countdown to the resend button on",
  );
});

test("trailing punctuation is dropped", () => {
  assert.equal(spokenGist("update the readme,"), "update the readme");
});

test("an empty task is spoken as its task", () => {
  assert.equal(spokenGist("  please  "), "its task");
});

const WICKED_TASK = { project: "wicked-fe", session: "s1", label: "wicked-fe", sessionNumber: 1 };

test("a finished task's headline names the session and the gist", () => {
  const e = { kind: "task_done", ...WICKED_TASK, task: "Please add a resend countdown.", result: "ok" } as const;
  assert.equal(taskHeadline(e), "wicked-fe session 1 done: add a resend countdown");
});

test("a failed task's headline says it failed", () => {
  const e = { kind: "task_failed", ...WICKED_TASK, task: "run the tests", error: "boom" } as const;
  assert.equal(taskHeadline(e), "wicked-fe session 1 failed: run the tests");
});
