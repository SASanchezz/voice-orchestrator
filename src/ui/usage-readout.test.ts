import assert from "node:assert/strict";
import { test } from "node:test";
import { usageReadout } from "./usage-readout.js";

const NOW = new Date(2026, 9, 30, 12, 0);

test("shows the 5-hour limit before the week", () => {
  const usage = { account: "work", fiveHour: { remainingPercent: 54 }, week: { remainingPercent: 17 } };
  const labels = usageReadout(usage, NOW).map((item) => item.label);
  assert.deepEqual(labels, ["5h", "Week"]);
});

test("skips a limit the account doesn't report", () => {
  const usage = { account: "work", week: { remainingPercent: 17 } };
  const labels = usageReadout(usage, NOW).map((item) => item.label);
  assert.deepEqual(labels, ["Week"]);
});

test("the tooltip says when the limit resets", () => {
  const resetsAt = new Date(2026, 9, 30, 15, 50).toISOString();
  const usage = { account: "work", fiveHour: { remainingPercent: 54, resetsAt } };
  const [item] = usageReadout(usage, NOW);
  assert.match(item.title, /^54% of the 5-hour limit left, resets .*:50/);
});

test("plenty left is ok", () => {
  const [item] = usageReadout({ account: "work", week: { remainingPercent: 26 } }, NOW);
  assert.equal(item.level, "ok");
});

test("a quarter left warns", () => {
  const [item] = usageReadout({ account: "work", week: { remainingPercent: 25 } }, NOW);
  assert.equal(item.level, "warn");
});

test("a tenth left is critical", () => {
  const [item] = usageReadout({ account: "work", week: { remainingPercent: 10 } }, NOW);
  assert.equal(item.level, "critical");
});
