import assert from "node:assert/strict";
import { test } from "node:test";
import { compactWhen } from "./reply-when.js";

const NOW = new Date(2026, 10, 17, 15, 0);

function minutesBefore(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

test("reply when: under a minute is now", () => {
  assert.equal(compactWhen(minutesBefore(0), NOW, "en-GB"), "now");
});

test("reply when: under an hour is in minutes", () => {
  assert.equal(compactWhen(minutesBefore(12), NOW, "en-GB"), "12m");
});

test("reply when: earlier today is the time", () => {
  assert.equal(compactWhen(new Date(2026, 10, 17, 9, 5), NOW, "en-GB"), "09:05");
});

test("reply when: the day before is yesterday", () => {
  assert.equal(compactWhen(new Date(2026, 10, 16, 21, 35), NOW, "en-GB"), "Yesterday");
});

test("reply when: an earlier day this year is its date", () => {
  assert.equal(compactWhen(new Date(2026, 9, 3, 10, 0), NOW, "en-GB"), "3 Oct");
});

test("reply when: another year says the year", () => {
  assert.equal(compactWhen(new Date(2025, 9, 3, 10, 0), NOW, "en-GB"), "3 Oct 2025");
});
