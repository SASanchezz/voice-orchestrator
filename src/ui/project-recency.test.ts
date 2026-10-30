import { test } from "node:test";
import assert from "node:assert/strict";
import type { ProjectView, SessionView } from "./protocol.js";
import { byRecentActivity } from "./project-recency.js";

type SessionTimes = Pick<SessionView, "startedAt" | "finishedAt" | "queuedAt">;

function session(times: SessionTimes, status: SessionView["status"] = "done"): SessionView {
  return { id: "s", number: 1, status, queued: [], costUsd: 0, history: [], ...times };
}

function project(name: string, ...sessions: SessionView[]): ProjectView {
  return { name, profile: "personal", folder: "", folderFromHome: "", activeSession: "", sessions };
}

function namesOf(projects: ProjectView[]): string[] {
  return projects.map((p) => p.name);
}

test("the project that finished a task last comes first", () => {
  const older = project("older", session({ finishedAt: "2026-10-30T09:00:00.000Z" }));
  const newer = project("newer", session({ finishedAt: "2026-10-30T10:00:00.000Z" }));
  assert.deepEqual(namesOf(byRecentActivity([older, newer])), ["newer", "older"]);
});

test("a freshly queued instruction counts as activity", () => {
  const finished = project("finished", session({ finishedAt: "2026-10-30T10:00:00.000Z" }));
  const queued = project(
    "queued",
    session({ finishedAt: "2026-10-30T08:00:00.000Z", queuedAt: "2026-10-30T11:00:00.000Z" }),
  );
  assert.deepEqual(namesOf(byRecentActivity([finished, queued])), ["queued", "finished"]);
});

test("the latest activity of any of a project's sessions counts", () => {
  const single = project("single", session({ startedAt: "2026-10-30T10:00:00.000Z" }));
  const recentSecond = session({ startedAt: "2026-10-30T12:00:00.000Z" });
  const several = project("several", session({ startedAt: "2026-10-30T09:00:00.000Z" }), recentSecond);
  assert.deepEqual(namesOf(byRecentActivity([single, several])), ["several", "single"]);
});

test("a project with a running task stays above one that finished later", () => {
  const running = project("running", session({ startedAt: "2026-10-30T08:00:00.000Z" }, "running"));
  const finished = project("finished", session({ finishedAt: "2026-10-30T10:00:00.000Z" }));
  assert.deepEqual(namesOf(byRecentActivity([finished, running])), ["running", "finished"]);
});

test("projects without activity sort last, in their original order", () => {
  const active = project("active", session({ finishedAt: "2026-10-30T10:00:00.000Z" }));
  const sorted = byRecentActivity([project("quiet-a", session({})), active, project("quiet-b")]);
  assert.deepEqual(namesOf(sorted), ["active", "quiet-a", "quiet-b"]);
});
