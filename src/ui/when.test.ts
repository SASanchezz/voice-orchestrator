import { test } from "node:test";
import assert from "node:assert/strict";
import { formatWaiting, formatWhen } from "./when.js";

// Times without a zone are local, so each test reads the same in any time zone; the language is fixed for the same reason.
const LOCALE = "en-US";
const at = (localTime: string) => new Date(localTime);
const NOW = at("2026-10-15T16:30");
const minutesBefore = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

test("when: today shows the time alone", () => {
  assert.equal(formatWhen(at("2026-10-15T14:05"), NOW, LOCALE), "02:05 PM");
});

test("when: an earlier day this year shows a short date and the time", () => {
  assert.equal(formatWhen(at("2026-10-13T14:05"), NOW, LOCALE), "Oct 13, 02:05 PM");
});

test("when: just after midnight yesterday's late entries show their date", () => {
  const justAfterMidnight = at("2026-10-16T00:10");
  assert.equal(formatWhen(at("2026-10-15T23:50"), justAfterMidnight, LOCALE), "Oct 15, 11:50 PM");
});

test("when: an earlier year adds the year", () => {
  assert.equal(formatWhen(at("2025-12-31T09:00"), NOW, LOCALE), "Dec 31, 2025, 09:00 AM");
});

test("waiting: under a minute reads just now", () => {
  assert.equal(formatWaiting(minutesBefore(0.2), NOW, LOCALE), "just now");
});

test("waiting: under an hour counts minutes", () => {
  assert.equal(formatWaiting(minutesBefore(12), NOW, LOCALE), "12 min ago");
});

test("waiting: an hour or more names when it started", () => {
  assert.equal(formatWaiting(minutesBefore(90), NOW, LOCALE), "since 03:00 PM");
});

test("waiting: since an earlier day names its date", () => {
  assert.equal(formatWaiting(at("2026-10-14T09:15"), NOW, LOCALE), "since Oct 14, 09:15 AM");
});
