import { test } from "node:test";
import assert from "node:assert/strict";
import { isResetTime, resetTimeAfter } from "./reset-time.js";

// 2026-11-08 20:29 in Warsaw (UTC+1 in November).
const LIMIT_HIT = new Date("2026-11-08T19:29:16Z");

test("reset time: a time past midnight is the next day, in its own time zone", () => {
  assert.equal(resetTimeAfter("12:10am (Europe/Warsaw)", LIMIT_HIT).toISOString(), "2026-11-08T23:10:00.000Z");
});

test("reset time: a later hour the same evening is that day", () => {
  assert.equal(resetTimeAfter("9pm (Europe/Warsaw)", LIMIT_HIT).toISOString(), "2026-11-08T20:00:00.000Z");
});

test("reset time: a date names that day", () => {
  assert.equal(resetTimeAfter("Nov 12, 3pm (Europe/Warsaw)", LIMIT_HIT).toISOString(), "2026-11-12T14:00:00.000Z");
});

test("reset time: an unknown wording isn't a reset time", () => {
  assert.equal(isResetTime("soon"), false);
});

test("reset time: an unknown time zone isn't a reset time", () => {
  assert.equal(isResetTime("9pm (Mars/Olympus)"), false);
});

test("reset time: the wording Claude Code uses is one", () => {
  assert.equal(isResetTime("12:10am (Europe/Warsaw)"), true);
});
