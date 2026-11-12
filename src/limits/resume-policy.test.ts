import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LIMITS } from "../config/limits-config.js";
import { ResumePolicy } from "./resume-policy.js";
import type { SavedTodo } from "./todo-file.js";

const policy = new ResumePolicy(DEFAULT_LIMITS);

const SAVED: SavedTodo = {
  id: "20261108-192916-casini-gdk-s15",
  project: "casini-gdk",
  sessionNumber: 15,
  account: "work",
  savedAt: "2026-11-08T19:29:16.448Z",
  resetsAt: "12:10am (Europe/Warsaw)",
  task: "Drop the Util names.",
};

const dueAt = (now: string, saved: SavedTodo = SAVED) => policy.due([saved], new Date(now)).length === 1;

test("resume policy: a task isn't due before its limit resets", () => {
  assert.equal(dueAt("2026-11-08T23:05:00Z"), false);
});

test("resume policy: a task waits a few minutes' grace after the reset", () => {
  assert.equal(dueAt("2026-11-08T23:11:00Z"), false);
});

test("resume policy: a task is due once the reset and its grace have passed", () => {
  assert.equal(dueAt("2026-11-08T23:14:00Z"), true);
});

test("resume policy: without a reset time a task is due an hour after it was saved", () => {
  assert.equal(dueAt("2026-11-08T20:33:00Z", { ...SAVED, resetsAt: undefined }), true);
});

test("resume policy: a task saved over a day ago waits for you", () => {
  assert.equal(dueAt("2026-11-10T08:00:00Z"), false);
});
