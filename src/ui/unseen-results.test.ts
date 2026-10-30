import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProjectView, SessionStatus, SessionView } from "./protocol.js";
import { allSeen, hasUnseenResult, withSeen } from "./unseen-results.js";

const FIRST = "2026-10-29T09:00:00.000Z";
const SECOND = "2026-10-29T10:00:00.000Z";

function session(status: SessionStatus, ...finishedAt: string[]): SessionView {
  const outcome = status === "stopped" ? "stopped" : "done";
  const history = finishedAt.map((at) => ({ task: "t", outcome, result: "", finishedAt: at }) as const);
  return { id: "s1", number: 1, status, queued: [], costUsd: 0, history };
}

function project(...sessions: SessionView[]): ProjectView {
  return { name: "webshop", profile: "personal", folder: "", folderFromHome: "", activeSession: "s1", sessions };
}

test("unseen results: a finished task not looked at shines", () => {
  assert.equal(hasUnseenResult(session("done", FIRST), {}), true);
});

test("unseen results: a session that never finished anything doesn't shine", () => {
  assert.equal(hasUnseenResult(session("idle"), {}), false);
});

test("unseen results: a seen result no longer shines", () => {
  const finished = session("done", FIRST);
  assert.equal(hasUnseenResult(finished, withSeen({}, finished)), false);
});

test("unseen results: a newer result shines again", () => {
  assert.equal(hasUnseenResult(session("failed", FIRST, SECOND), { s1: FIRST }), true);
});

test("unseen results: a session working on its next task waits to shine until it is done", () => {
  assert.equal(hasUnseenResult(session("running", FIRST), {}), false);
});

test("unseen results: on the page's first run every result counts as seen", () => {
  assert.equal(hasUnseenResult(session("done", FIRST), allSeen([project(session("done", FIRST))])), false);
});

test("unseen results: seeing a result already seen keeps the same record", () => {
  const seen = { s1: FIRST };
  assert.equal(withSeen(seen, session("done", FIRST)), seen);
});

test("unseen results: a task you stopped yourself doesn't shine", () => {
  assert.equal(hasUnseenResult(session("stopped", FIRST), {}), false);
});
