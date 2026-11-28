import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProjectView, SessionView } from "./protocol.js";
import {
  ASSISTANT_TARGET,
  ASSISTANT_TARGET_ID,
  defaultTargetOf,
  sessionContextOf,
  sessionTargetsOf,
} from "./quick-targets.js";

function session(id: string, changes: Partial<SessionView> = {}): SessionView {
  return { id, number: 1, status: "done", queued: [], costUsd: 0, history: [], ...changes };
}

function project(name: string, ...sessions: SessionView[]): ProjectView {
  return { name, profile: "personal", folder: "", folderFromHome: "", activeSession: "", sessions };
}

function idsOf(projects: ProjectView[]): string[] {
  return sessionTargetsOf(projects).map((target) => target.id);
}

const finishedEarly = session("early", { finishedAt: "2026-11-20T09:00:00.000Z" });
const finishedLate = session("late", { finishedAt: "2026-11-20T10:00:00.000Z" });

test("the session active most recently comes first, across projects", () => {
  assert.deepEqual(idsOf([project("one", finishedEarly), project("two", finishedLate)]), ["late", "early"]);
});

test("a session target is named by its project and title", () => {
  const [target] = sessionTargetsOf([project("billing", session("s", { title: "fix tests" }))]);
  assert.equal(target.name, "billing › fix tests");
});

test("a running session's target says it is working", () => {
  const [target] = sessionTargetsOf([project("billing", session("s", { status: "running" }))]);
  assert.equal(target.detail, "working");
});

test("the session you sent to last is the default while it is open", () => {
  const targets = sessionTargetsOf([project("p", finishedEarly, finishedLate)]);
  assert.equal(defaultTargetOf(targets, "early").id, "early");
});

test("a closed session you sent to last falls back to the most recent one", () => {
  const targets = sessionTargetsOf([project("p", finishedEarly, finishedLate)]);
  assert.equal(defaultTargetOf(targets, "gone").id, "late");
});

test("the assistant stays the default once you sent to it", () => {
  const targets = sessionTargetsOf([project("p", finishedLate)]);
  assert.equal(defaultTargetOf(targets, ASSISTANT_TARGET_ID), ASSISTANT_TARGET);
});

test("with no sessions open the assistant is the default", () => {
  assert.equal(defaultTargetOf([], undefined), ASSISTANT_TARGET);
});

test("a session waiting for approval says so", () => {
  assert.equal(sessionContextOf(session("s", { status: "waiting_permission" })), "Waiting for your approval");
});

test("a running session names its task and how many wait behind it", () => {
  const queued = [
    { id: "q1", instruction: "next" },
    { id: "q2", instruction: "after" },
  ];
  const running = session("s", { status: "running", task: "run the e2e suite\nthen push", queued });
  assert.equal(sessionContextOf(running), "Working on: run the e2e suite (2 queued)");
});

test("a finished session shows the first line of its latest reply", () => {
  const history = [{ task: "t", outcome: "done" as const, result: "All 42 tests pass.\nDetails…", finishedAt: "" }];
  assert.equal(sessionContextOf(session("s", { history })), "Last reply: All 42 tests pass.");
});

test("a session that never ran a task says so", () => {
  assert.equal(sessionContextOf(session("s")), "No tasks yet");
});
