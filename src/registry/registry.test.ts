import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry, type RegistryParts } from "./open-registry.js";
import { TaskHistory } from "./task-history.js";

/** Points state at a new empty folder, so each test starts from nothing on disk. */
function freshStateDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "vo-registry-"));
  setStateDir(dir);
  return dir;
}

function reopen(): RegistryParts {
  return openRegistry({ webshop: "personal" }, new AppEvents());
}

function freshRegistry(): RegistryParts {
  freshStateDir();
  return reopen();
}

function historyOf({ projects, sessions }: RegistryParts): TaskHistory {
  return new TaskHistory(projects, sessions);
}

test("a project starts with one active session", () => {
  const { registry } = freshRegistry();
  assert.equal(registry.activeSession("webshop").number, 1);
});

test("a new session gets the next number and becomes active", () => {
  const { registry } = freshRegistry();
  const second = registry.createSession("webshop");
  assert.deepEqual([second.number, registry.activeSession("webshop").id], [2, second.id]);
});

test("switching makes the chosen session active", () => {
  const { registry } = freshRegistry();
  const first = registry.activeSession("webshop");
  registry.createSession("webshop");
  registry.activate(registry.sessionByNumber("webshop", 1).id);
  assert.equal(registry.activeSession("webshop").id, first.id);
});

test("sessions are named by number only once a project has several", () => {
  const { registry, sessions } = freshRegistry();
  const first = registry.activeSession("webshop");
  const solo = sessions.labelOf(first.id);
  registry.createSession("webshop");
  assert.deepEqual([solo, sessions.labelOf(first.id)], ["webshop", "webshop session 1"]);
});

test("removing a session forgets it and its history", () => {
  const parts = freshRegistry();
  const second = parts.registry.createSession("webshop");
  historyOf(parts).record(second.id, { task: "add rate limiting", outcome: "done", result: "Done." });
  parts.registry.removeSession(second.id);
  assert.equal(historyOf(parts).historyOf("webshop"), "No finished tasks recorded for webshop.");
});

test("removing the active session activates another open one", () => {
  const { registry } = freshRegistry();
  const first = registry.activeSession("webshop");
  registry.removeSession(registry.createSession("webshop").id);
  assert.equal(registry.activeSession("webshop").id, first.id);
});

test("removing the last session leaves a fresh empty one", () => {
  const { registry } = freshRegistry();
  const only = registry.activeSession("webshop");
  registry.removeSession(only.id);
  assert.notEqual(registry.activeSession("webshop").id, only.id);
});

test("sessions survive a restart, with removed ones gone", () => {
  const { registry } = freshRegistry();
  registry.removeSession(registry.createSession("webshop").id);
  registry.createSession("webshop");
  assert.deepEqual(
    reopen()
      .sessions.sessionsOf("webshop")
      .map((s) => s.number),
    [1, 2],
  );
});

test("clearing a session forgets its history", () => {
  const parts = freshRegistry();
  const session = parts.registry.activeSession("webshop");
  historyOf(parts).record(session.id, { task: "add rate limiting", outcome: "done", result: "Done." });
  parts.registry.clearSession(session.id);
  assert.equal(historyOf(parts).historyOf("webshop"), "No finished tasks recorded for webshop.");
});

test("clearing a session drops its worker conversation", () => {
  const { registry, sessions } = freshRegistry();
  const session = registry.activeSession("webshop");
  sessions.updateSession(session.id, { claudeSessionId: "abc" });
  registry.clearSession(session.id);
  assert.equal(sessions.session(session.id).claudeSessionId, undefined);
});

test("clearing a session keeps it open under its number", () => {
  const { registry } = freshRegistry();
  const second = registry.createSession("webshop");
  registry.clearSession(second.id);
  assert.equal(registry.sessionByNumber("webshop", 2).id, second.id);
});

test("a session's worker conversation survives a restart", () => {
  const { registry, sessions } = freshRegistry();
  sessions.updateSession(registry.activeSession("webshop").id, { claudeSessionId: "abc" });
  assert.equal(reopen().registry.activeSession("webshop").claudeSessionId, "abc");
});

test("a registry saved before sessions becomes one session per project", () => {
  const dir = freshStateDir();
  const legacy = {
    webshop: {
      name: "webshop",
      profile: "work",
      sessionId: "abc",
      status: "done",
      costUsd: 1,
      history: [],
      queued: [],
    },
  };
  writeFileSync(join(dir, "registry.json"), JSON.stringify(legacy));
  const session = reopen().registry.activeSession("webshop");
  assert.deepEqual([session.claudeSessionId, session.status, session.costUsd], ["abc", "done", 1]);
});

test("removing a project forgets it and all its sessions, also after a restart", () => {
  const { registry, projects } = freshRegistry();
  registry.createSession("webshop");
  registry.removeProject("webshop");
  const { sessions } = openRegistry({}, new AppEvents());
  assert.deepEqual([projects.has("webshop"), sessions.sessionsOf("webshop").length], [false, 0]);
});

test("removing a project announces each of its sessions as removed, so their chats are deleted", () => {
  freshStateDir();
  const events = new AppEvents();
  const removed: string[] = [];
  events.on("session_removed", (id: string) => removed.push(id));
  const { registry, sessions } = openRegistry({ webshop: "personal" }, events);
  registry.createSession("webshop");
  const ids = sessions.sessionsOf("webshop").map((s) => s.id);
  registry.removeProject("webshop");
  assert.deepEqual(removed, ids);
});
