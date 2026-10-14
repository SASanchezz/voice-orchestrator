import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChatMessageView } from "./protocol.js";
import { sessionRows, stepsSummary, unchangedRowCount } from "./session-steps.js";

let nextId = 1;
function line(kind: ChatMessageView["kind"], text: string): ChatMessageView {
  return { id: nextId++, at: "2026-10-14T09:00:00.000Z", kind, text };
}
const shape = (messages: ChatMessageView[]) =>
  sessionRows(messages).map((row) => (row.kind === "line" ? row.message.text : row.steps.map((s) => s.text)));

test("session steps: tool calls in a row fold into one block between the task and the answer", () => {
  const messages = [
    line("task", "fix the tests"),
    line("tool", "Bash npm test"),
    line("tool", "Edit src/app.ts"),
    line("reply", "Fixed the failing test."),
    line("status", "Finished."),
  ];
  assert.deepEqual(shape(messages), [
    "fix the tests",
    ["Bash npm test", "Edit src/app.ts"],
    "Fixed the failing test.",
    "Finished.",
  ]);
});

test("session steps: a comment followed by another tool call is a step", () => {
  const messages = [line("tool", "Read a.ts"), line("reply", "Now the tests."), line("tool", "Bash npm test")];
  assert.deepEqual(shape(messages), [["Read a.ts", "Now the tests.", "Bash npm test"]]);
});

test("session steps: while running, the newest comment stays in view", () => {
  const messages = [line("tool", "Read a.ts"), line("reply", "Looking at the tests next.")];
  assert.deepEqual(shape(messages), [["Read a.ts"], "Looking at the tests next."]);
});

test("session steps: a later run's tool calls don't fold the previous answer", () => {
  const messages = [
    line("reply", "Done."),
    line("status", "Finished."),
    line("task", "again"),
    line("tool", "Bash ls"),
  ];
  assert.deepEqual(shape(messages), ["Done.", "Finished.", "again", ["Bash ls"]]);
});

test("session steps: questions and permission requests split the steps around them", () => {
  const messages = [
    line("tool", "Bash ls"),
    line("permission", "asks: Bash rm -rf tmp"),
    line("tool", "Bash rm -rf tmp"),
  ];
  assert.deepEqual(shape(messages), [["Bash ls"], "asks: Bash rm -rf tmp", ["Bash rm -rf tmp"]]);
});

test("session steps: a block keeps the key of its first step as it grows", () => {
  const first = line("tool", "Bash ls");
  const before = sessionRows([first]);
  const after = sessionRows([first, line("tool", "Bash pwd")]);
  assert.equal(after[0]?.key, before[0]?.key);
});

test("session steps: the summary counts the steps and names the latest", () => {
  const steps = [line("tool", "Read a.ts"), line("tool", "Bash grep -rn foo src")];
  assert.equal(stepsSummary(steps), "2 steps, last: Bash grep -rn foo src");
});

test("session steps: a single step is named on its own", () => {
  assert.equal(stepsSummary([line("tool", "Edit src/app.ts")]), "1 step: Edit src/app.ts");
});

test("session steps: the summary shows only the first line of a long comment, shortened", () => {
  const comment = `${"x".repeat(100)}\nsecond line`;
  assert.equal(stepsSummary([line("reply", comment)]), `1 step: ${"x".repeat(80)}…`);
});

test("session steps: rows before a grown block are unchanged", () => {
  const task = line("task", "go");
  const step = line("tool", "Bash ls");
  const before = sessionRows([task, step]);
  assert.equal(unchangedRowCount(before, sessionRows([task, step, line("tool", "Bash pwd")])), 1);
});

test("session steps: a new line after unchanged rows leaves them all in place", () => {
  const rows = [line("task", "go"), line("tool", "Bash ls")];
  assert.equal(unchangedRowCount(sessionRows(rows), sessionRows([...rows, line("status", "Finished.")])), 2);
});

test("session steps: a shown answer that becomes a step redraws from its block", () => {
  const messages = [line("task", "go"), line("tool", "Bash ls"), line("reply", "Next, tests.")];
  const before = sessionRows(messages);
  assert.equal(unchangedRowCount(before, sessionRows([...messages, line("tool", "Bash npm test")])), 1);
});
