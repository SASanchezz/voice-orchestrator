import { test } from "node:test";
import assert from "node:assert/strict";
import { detectUsageLimit, usageLimitMessage } from "./usage-limit.js";

const SPEND_LIMIT =
  "You've hit your org's monthly spend limit · run /usage-credits to ask your admin for a higher limit · your session limit resets 9pm (Europe/Warsaw)";

test("limits: an org spend limit is detected", () => {
  assert.ok(detectUsageLimit(SPEND_LIMIT));
});

test("limits: the reset time is read from the error", () => {
  assert.equal(detectUsageLimit(SPEND_LIMIT)?.resetsAt, "9pm (Europe/Warsaw)");
});

test("limits: the error Claude Code throws after the result is detected too", () => {
  assert.equal(
    detectUsageLimit(`Claude Code returned an error result: ${SPEND_LIMIT}`)?.resetsAt,
    "9pm (Europe/Warsaw)",
  );
});

test("limits: a usage limit without a reset time is detected", () => {
  assert.deepEqual(detectUsageLimit("Claude AI usage limit reached"), {});
});

test("limits: a session limit is detected", () => {
  assert.equal(detectUsageLimit("5-hour session limit reached ∙ resets 3pm")?.resetsAt, "3pm");
});

test("limits: an ordinary failure is not a limit", () => {
  assert.equal(detectUsageLimit("error_max_turns"), undefined);
});

test("limits: the message names project, account, reset time and saved tasks", () => {
  const limit = { project: "webshop", account: "work", resetsAt: "9pm (Europe/Warsaw)", savedTasks: 2 };
  assert.equal(
    usageLimitMessage(limit),
    "webshop hit the work account limit; resets 9pm (Europe/Warsaw); 2 tasks saved to todo",
  );
});

test("limits: the message reads well for one task and no reset time", () => {
  const limit = { project: "webshop", account: "work", savedTasks: 1 };
  assert.equal(usageLimitMessage(limit), "webshop hit the work account limit; 1 task saved to todo");
});
