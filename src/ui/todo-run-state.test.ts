import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProjectView, SessionView, TodoItemView } from "./protocol.js";
import { isActive, placeRuns, type TodoRunState } from "./todo-run-state.js";

const FOOTER = "Fix the footer";
const OTHER = "Bump the version";

function session(changes: Partial<SessionView>): SessionView {
  return { id: "s1", number: 1, status: "idle", queued: [], costUsd: 0, history: [], ...changes };
}

function project(...sessions: SessionView[]): ProjectView {
  return { name: "webshop", profile: "personal", folder: "", folderFromHome: "", activeSession: "s1", sessions };
}

function footerItem(...sessionIds: string[]): TodoItemView {
  const runs = sessionIds.map((sessionId) => ({ project: "webshop", sessionId, instruction: FOOTER, sentAt: "" }));
  return { id: 1, title: FOOTER, description: "", done: false, createdAt: "", runs };
}

function stateIn(...sessions: SessionView[]): TodoRunState | undefined {
  return placeRuns([footerItem("s1")], [project(...sessions)])[0]?.state;
}

function finished(task: string, outcome: "done" | "failed") {
  return { task, outcome, result: "", finishedAt: "" };
}

test("todo run: the session working on it gives its status", () => {
  assert.equal(stateIn(session({ status: "running", task: FOOTER })), "running");
});

test("todo run: waiting behind the session's running task is queued", () => {
  assert.equal(stateIn(session({ status: "running", task: OTHER, queued: [FOOTER] })), "queued");
});

test("todo run: a run sent again while it still runs shows as running", () => {
  assert.equal(stateIn(session({ status: "running", task: FOOTER, queued: [FOOTER] })), "running");
});

test("todo run: once the session moved on, its outcome comes from the history", () => {
  const moved = session({ status: "running", task: OTHER, history: [finished(FOOTER, "failed")] });
  assert.equal(stateIn(moved), "failed");
});

test("todo run: the latest outcome of the same task counts", () => {
  const history = [finished(FOOTER, "failed"), finished(FOOTER, "done")];
  assert.equal(stateIn(session({ task: OTHER, history })), "done");
});

test("todo run: no trace in the session means just sent", () => {
  assert.equal(stateIn(session({ task: OTHER })), "sent");
});

test("todo run: a session closed since is reported closed", () => {
  assert.equal(stateIn(session({ id: "other" })), "closed");
});

test("todo run: runs of one item in two sessions are placed separately", () => {
  const sessions = [session({ status: "running", task: FOOTER }), session({ id: "s2", number: 2, queued: [FOOTER] })];
  const states = placeRuns([footerItem("s1", "s2")], [project(...sessions)]).map((placed) => placed.state);
  assert.deepEqual(states, ["running", "queued"]);
});

test("todo run: running, waiting and queued runs are active", () => {
  assert.deepEqual((["running", "waiting_permission", "queued"] as const).map(isActive), [true, true, true]);
});

test("todo run: finished, sent and closed runs are not active", () => {
  assert.deepEqual((["done", "failed", "stopped", "sent", "closed"] as const).map(isActive), [
    false,
    false,
    false,
    false,
    false,
  ]);
});
