import { test } from "node:test";
import assert from "node:assert/strict";
import { withInstruction, withoutTask, withTaskFirst } from "./queue-edits.js";

const QUEUED = [
  { id: "a", instruction: "add tests" },
  { id: "b", instruction: "fix the footer", model: "opus" },
  { id: "c", instruction: "bump the version" },
];

const idsOf = (queued: { id: string }[]) => queued.map((item) => item.id);

test("queue edits: removing a task keeps the others in order", () => {
  assert.deepEqual(idsOf(withoutTask(QUEUED, "b")), ["a", "c"]);
});

test("queue edits: editing changes only that task's instruction", () => {
  assert.deepEqual(withInstruction(QUEUED, "b", "fix the header")[1], {
    id: "b",
    instruction: "fix the header",
    model: "opus",
  });
});

test("queue edits: moving a task first keeps the others in order", () => {
  assert.deepEqual(idsOf(withTaskFirst(QUEUED, "c")), ["c", "a", "b"]);
});

test("queue edits: a task that is gone leaves the queue as it was", () => {
  assert.deepEqual(withTaskFirst(QUEUED, "gone"), QUEUED);
});
