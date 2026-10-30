import assert from "node:assert/strict";
import { test } from "node:test";
import { Readable } from "node:stream";
import type { QueryFn } from "../agent/query-fn.js";
import { fakeQuery } from "../testing/fake-query.js";
import { testConfig } from "../testing/test-config.js";
import { PlanUsageReader } from "./plan-usage-reader.js";

const WORK_ONLY = testConfig({ profiles: { work: { configDir: "/tmp/work" } } });

const noPlan = () => Promise.resolve({ rate_limits_available: false, rate_limits: null });
const failing = () => Promise.reject(new Error("offline"));

function queryAnswering(usage: () => Promise<unknown>, closed: string[] = []): QueryFn {
  const run = { usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET: usage, close: () => closed.push("closed") };
  return fakeQuery(() => Object.assign(Readable.from([]), run));
}

function planLimits(fiveHourUsed: number | null, weekUsed: number | null): () => Promise<unknown> {
  const resets_at = "2026-10-30T15:50:00+00:00";
  const rate_limits = {
    five_hour: { utilization: fiveHourUsed, resets_at },
    seven_day: { utilization: weekUsed, resets_at: null },
  };
  return () => Promise.resolve({ rate_limits_available: true, rate_limits });
}

test("turns what was used into what is left", async () => {
  const reader = new PlanUsageReader(WORK_ONLY, queryAnswering(planLimits(46, 83)));
  const [usage] = await reader.readAll();
  assert.equal(usage.fiveHour?.remainingPercent, 54);
});

test("keeps when a limit resets", async () => {
  const reader = new PlanUsageReader(WORK_ONLY, queryAnswering(planLimits(46, 83)));
  const [usage] = await reader.readAll();
  assert.equal(usage.fiveHour?.resetsAt, "2026-10-30T15:50:00+00:00");
});

test("never reports less than nothing left", async () => {
  const reader = new PlanUsageReader(WORK_ONLY, queryAnswering(planLimits(104, 83)));
  const [usage] = await reader.readAll();
  assert.equal(usage.fiveHour?.remainingPercent, 0);
});

test("leaves out a limit with no utilization", async () => {
  const reader = new PlanUsageReader(WORK_ONLY, queryAnswering(planLimits(46, null)));
  const [usage] = await reader.readAll();
  assert.equal(usage.week, undefined);
});

test("an account without a plan has no limits", async () => {
  const reader = new PlanUsageReader(WORK_ONLY, queryAnswering(noPlan));
  assert.deepEqual(await reader.readAll(), [{ account: "work", fiveHour: undefined, week: undefined }]);
});

test("a failed read still names the account", async (t) => {
  t.mock.method(console, "error", () => undefined);
  const reader = new PlanUsageReader(WORK_ONLY, queryAnswering(failing));
  assert.deepEqual(await reader.readAll(), [{ account: "work" }]);
});

test("closes Claude Code after reading", async () => {
  const closed: string[] = [];
  const reader = new PlanUsageReader(WORK_ONLY, queryAnswering(planLimits(46, 83), closed));
  await reader.readAll();
  assert.deepEqual(closed, ["closed"]);
});
