import { test } from "node:test";
import assert from "node:assert/strict";
import { spokenGist } from "./gist.js";

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
