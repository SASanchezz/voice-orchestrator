import { test } from "node:test";
import assert from "node:assert/strict";
import { pickQueued, queuedLine } from "./queue-pick.js";

const QUEUED = ["add tests for login", "fix the footer", "fix the header"];

test("queue pick: a place picks that task", () => {
  assert.equal(pickQueued(QUEUED, { place: 2 }), 1);
});

test("queue pick: a place past the end is an error", () => {
  assert.throws(() => pickQueued(QUEUED, { place: 4 }), /There is no #4; 3 queued/);
});

test("queue pick: words from one instruction pick it, ignoring case", () => {
  assert.equal(pickQueued(QUEUED, { match: "FOOTER" }), 1);
});

test("queue pick: words in several instructions ask which one", () => {
  assert.throws(
    () => pickQueued(QUEUED, { match: "fix" }),
    /Several queued tasks mention "fix": #2 fix the footer; #3 fix the header/,
  );
});

test("queue pick: words in none is an error", () => {
  assert.throws(() => pickQueued(QUEUED, { match: "deploy" }), /No queued task mentions "deploy"/);
});

test("queue pick: a place whose task changed is an error", () => {
  assert.throws(() => pickQueued(QUEUED, { place: 1, match: "fix the footer" }), /The queue changed: #1 is now/);
});

test("queue pick: a place still holding the task picks it", () => {
  assert.equal(pickQueued(QUEUED, { place: 3, match: "fix the header" }), 2);
});

test("queue pick: neither place nor words is an error", () => {
  assert.throws(() => pickQueued(QUEUED, {}), /Say which queued task/);
});

test("queue pick: a long instruction is shortened to one line", () => {
  assert.equal(queuedLine(`first line\nsecond ${"x".repeat(80)}`, 0), `#1 first line second ${"x".repeat(42)}…`);
});
