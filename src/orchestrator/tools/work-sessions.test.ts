import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../../config/paths.js";
import { AppEvents } from "../../events/app-events.js";
import { openRegistry, type RegistryParts } from "../../registry/open-registry.js";
import { CROWDED_SESSION_COUNT, isUntouched, WorkSessions, type SessionCloser } from "./work-sessions.js";

/** Opening and counting sessions never closes any. */
const unusedCloser: SessionCloser = { closeOthers: () => Promise.resolve() };

function workSessionsOf({ registry, sessions }: RegistryParts): WorkSessions {
  return new WorkSessions(registry, sessions, unusedCloser);
}

function freshRegistry(): RegistryParts {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-new-work-")));
  return openRegistry({ webshop: "personal" }, new AppEvents());
}

/** The project's first session after it finished a task, so new work can't reuse it. */
function withFinishedFirstSession(): RegistryParts {
  const parts = freshRegistry();
  const first = parts.registry.activeSession("webshop");
  parts.sessions.updateSession(first.id, { status: "done", task: "Implement: the footer" });
  return parts;
}

function openSessionsUntil(parts: RegistryParts, count: number): void {
  while (parts.sessions.sessionsOf("webshop").length < count) {
    const opened = parts.registry.createSession("webshop");
    parts.sessions.updateSession(opened.id, { status: "done", task: "Analysis only: something" });
  }
}

test("new work opens a new session when the active one already worked on something", () => {
  const parts = withFinishedFirstSession();
  assert.equal(workSessionsOf(parts).openForNewWork("webshop").session.number, 2);
});

test("new work opens a new session even when the active one is idle after a task", () => {
  const parts = freshRegistry();
  const first = parts.registry.activeSession("webshop");
  parts.sessions.updateSession(first.id, { status: "idle", task: "Implement: the footer" });
  assert.equal(workSessionsOf(parts).openForNewWork("webshop").session.number, 2);
});

test("new work reuses a session nothing was sent to", () => {
  assert.equal(workSessionsOf(freshRegistry()).openForNewWork("webshop").session.number, 1);
});

test("a reused session says it was still empty", () => {
  assert.equal(
    workSessionsOf(freshRegistry()).openForNewWork("webshop").report,
    "Using webshop session 1, which was still empty; it is now active.",
  );
});

test("a reused session that wasn't active becomes the active one", () => {
  const parts = withFinishedFirstSession();
  const empty = parts.registry.createSession("webshop");
  parts.registry.activate(parts.registry.sessionByNumber("webshop", 1).id);
  workSessionsOf(parts).openForNewWork("webshop");
  assert.equal(parts.registry.activeSession("webshop").id, empty.id);
});

test("an opened session says so", () => {
  const parts = withFinishedFirstSession();
  assert.equal(workSessionsOf(parts).openForNewWork("webshop").report, "Opened webshop session 2; it is now active.");
});

test("a session carrying another session's handoff is not untouched", () => {
  const parts = freshRegistry();
  const first = parts.registry.activeSession("webshop");
  parts.sessions.updateSession(first.id, { handoff: "Earlier work on the footer." });
  assert.equal(isUntouched(parts.sessions.session(first.id)), false);
});

test("reaching the crowded count suggests closing the finished sessions", () => {
  const parts = freshRegistry();
  openSessionsUntil(parts, CROWDED_SESSION_COUNT);
  assert.match(workSessionsOf(parts).crowdingHint("webshop"), /^webshop now has 9 open sessions: offer once/);
});

test("past the crowded count the suggestion is not repeated", () => {
  const parts = freshRegistry();
  openSessionsUntil(parts, CROWDED_SESSION_COUNT + 1);
  assert.equal(workSessionsOf(parts).crowdingHint("webshop"), "");
});

test("below the crowded count there is no suggestion", () => {
  const parts = freshRegistry();
  openSessionsUntil(parts, CROWDED_SESSION_COUNT - 1);
  assert.equal(workSessionsOf(parts).crowdingHint("webshop"), "");
});
