import assert from "node:assert/strict";
import { test } from "node:test";
import { RecentPlanUsage } from "./recent-plan-usage.js";

function countingReader(): { readAll: () => Promise<never[]>; reads: () => number } {
  let reads = 0;
  return {
    readAll: () => {
      reads += 1;
      return Promise.resolve([]);
    },
    reads: () => reads,
  };
}

test("a second ask within the minute doesn't read again", async () => {
  const reader = countingReader();
  const usage = new RecentPlanUsage(reader, () => 1_000);
  await usage.all();
  await usage.all();
  assert.equal(reader.reads(), 1);
});

test("reads again once the minute is over", async () => {
  const reader = countingReader();
  let now = 1_000;
  const usage = new RecentPlanUsage(reader, () => now);
  await usage.all();
  now += 60_000;
  await usage.all();
  assert.equal(reader.reads(), 2);
});
