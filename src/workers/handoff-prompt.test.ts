import { test } from "node:test";
import assert from "node:assert/strict";
import { withHandoff } from "./handoff-prompt.js";

test("handoff prompt: the first task starts with the summary, then the task", () => {
  assert.match(
    withHandoff("add tests", "Done: the timer."),
    /Handoff summary.*\n\nDone: the timer\.\n\nYour task:\nadd tests$/s,
  );
});

test("handoff prompt: without a handoff the task is sent as it is", () => {
  assert.equal(withHandoff("add tests", undefined), "add tests");
});
