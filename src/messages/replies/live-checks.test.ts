import assert from "node:assert/strict";
import { test } from "node:test";
import { liveChecks, sendCheck } from "./live-checks.js";
import type { SourceHealth } from "./reply-health.js";

const QUIET = "Ask someone to DM you.";
const LISTENING: SourceHealth = { feed: "listening", heard: 0, passed: 0, drafted: 0, notNeeded: 0 };

function statuses(health: SourceHealth): string[] {
  return liveChecks(health, QUIET).map((check) => check.status);
}

test("live checks: replies off says where to turn them on", () => {
  assert.match(sendCheck(false, "under messages.telegram").fix ?? "", /send: true under messages\.telegram/);
});

test("live checks: replies off is a notice, not a failure, as it may be wanted", () => {
  assert.equal(sendCheck(false, "").status, "warn");
});

test("live checks: replies on passes", () => {
  assert.equal(sendCheck(true, "").status, "ok");
});

test("live checks: a feed that never started says to restart", () => {
  assert.match(liveChecks({ ...LISTENING, feed: "not started" }, QUIET)[0].fix ?? "", /Restart/);
});

test("live checks: a failed feed says why", () => {
  const [feed] = liveChecks({ ...LISTENING, feed: "failed", feedError: "no token" }, QUIET);
  assert.match(feed.detail, /no token/);
});

test("live checks: no messages yet is a warning with the hint", () => {
  const messages = liveChecks(LISTENING, QUIET)[1];
  assert.deepEqual([messages.status, messages.fix], ["warn", QUIET]);
});

test("live checks: events but no messages from people says so", () => {
  assert.match(liveChecks({ ...LISTENING, heard: 4 }, QUIET)[1].detail, /4 other events/);
});

test("live checks: a listening feed with messages and drafts passes", () => {
  assert.deepEqual(statuses({ ...LISTENING, passed: 2, lastPassed: new Date(), drafted: 1 }), ["ok", "ok", "ok"]);
});

test("live checks: no drafts yet isn't flagged twice, as no messages already is", () => {
  assert.equal(liveChecks(LISTENING, QUIET)[2].status, "ok");
});

test("live checks: a draft that failed is a failure with its reason", () => {
  const drafts = liveChecks({ ...LISTENING, passed: 1, lastFailure: "usage limit" }, QUIET)[2];
  assert.deepEqual([drafts.status, /usage limit/.test(drafts.detail)], ["fail", true]);
});
