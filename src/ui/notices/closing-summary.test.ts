import { test } from "node:test";
import assert from "node:assert/strict";
import { closingSummary } from "./closing-summary.js";

const LONG_WORK = "I changed the sign-up form and its tests. ".repeat(12);

test("closing summary: a short note is the summary", () => {
  assert.equal(closingSummary("  All tests pass.  "), "All tests pass.");
});

test("closing summary: a long note's summary is its last paragraph", () => {
  const note = `${LONG_WORK}\n\nAdded a resend countdown; you must pick its length.`;
  assert.equal(closingSummary(note), "Added a resend countdown; you must pick its length.");
});

test("closing summary: a code block at the end is not the summary", () => {
  const note = `${LONG_WORK}\n\nRun it with:\n\n\`\`\`\nnpm test\n\n\`\`\``;
  assert.equal(closingSummary(note), "Run it with:");
});

test("closing summary: a long note without paragraphs is the summary", () => {
  assert.equal(closingSummary(LONG_WORK), LONG_WORK.trim());
});
