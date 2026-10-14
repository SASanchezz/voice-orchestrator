import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProjectView, SessionStatus, SessionView } from "./protocol.js";
import { restartWarning, runningTaskCount } from "./running-tasks.js";

function session(status: SessionStatus): SessionView {
  return { id: status, number: 1, status, queued: [], costUsd: 0, history: [] };
}

function project(name: string, ...statuses: SessionStatus[]): ProjectView {
  const sessions = statuses.map(session);
  return { name, profile: "personal", folder: "", folderFromHome: "", activeSession: "", sessions };
}

test("no project means no running task", () => {
  assert.equal(runningTaskCount([]), 0);
});

test("finished, stopped and idle sessions are not running", () => {
  assert.equal(runningTaskCount([project("a", "idle", "done", "failed", "stopped")]), 0);
});

test("running sessions and those waiting for permission count, across projects", () => {
  assert.equal(runningTaskCount([project("a", "running", "idle"), project("b", "waiting_permission")]), 2);
});

test("the restart warning names one running task", () => {
  assert.match(restartWarning(1), /^1 running task will be stopped\./);
});

test("the restart warning counts several running tasks", () => {
  assert.match(restartWarning(3), /^3 running tasks will be stopped\./);
});
