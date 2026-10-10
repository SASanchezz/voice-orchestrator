import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "./config.js";
import { Registry } from "./registry.js";

/** Points state at a new empty folder, so each test starts from nothing on disk. */
function freshStateDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "vo-registry-"));
  setStateDir(dir);
  return dir;
}

function freshRegistry(): Registry {
  freshStateDir();
  return new Registry({ webshop: "personal" });
}

test("a project starts with one active session", () => {
  const registry = freshRegistry();
  assert.equal(registry.activeSession("webshop").number, 1);
});

test("a new session gets the next number and becomes active", () => {
  const registry = freshRegistry();
  const second = registry.createSession("webshop");
  assert.deepEqual([second.number, registry.activeSession("webshop").id], [2, second.id]);
});

test("switching makes the chosen session active", () => {
  const registry = freshRegistry();
  const first = registry.activeSession("webshop");
  registry.createSession("webshop");
  registry.activate(registry.sessionByNumber("webshop", 1).id);
  assert.equal(registry.activeSession("webshop").id, first.id);
});

test("sessions are named by number only once a project has several", () => {
  const registry = freshRegistry();
  const first = registry.activeSession("webshop");
  const solo = registry.labelOf(first.id);
  registry.createSession("webshop");
  assert.deepEqual([solo, registry.labelOf(first.id)], ["webshop", "webshop session 1"]);
});

test("removing a session forgets it and its history", () => {
  const registry = freshRegistry();
  const second = registry.createSession("webshop");
  registry.recordTask(second.id, { task: "add rate limiting", outcome: "done", result: "Done." });
  registry.removeSession(second.id);
  assert.equal(registry.historyOf("webshop"), "No finished tasks recorded for webshop.");
});

test("removing the active session activates another open one", () => {
  const registry = freshRegistry();
  const first = registry.activeSession("webshop");
  registry.removeSession(registry.createSession("webshop").id);
  assert.equal(registry.activeSession("webshop").id, first.id);
});

test("removing the last session leaves a fresh empty one", () => {
  const registry = freshRegistry();
  const only = registry.activeSession("webshop");
  registry.removeSession(only.id);
  assert.notEqual(registry.activeSession("webshop").id, only.id);
});

test("sessions survive a restart, with removed ones gone", () => {
  const registry = freshRegistry();
  registry.removeSession(registry.createSession("webshop").id);
  registry.createSession("webshop");
  assert.deepEqual(new Registry({ webshop: "personal" }).sessionsOf("webshop").map((s) => s.number), [1, 2]);
});

test("clearing a session forgets its history", () => {
  const registry = freshRegistry();
  const session = registry.activeSession("webshop");
  registry.recordTask(session.id, { task: "add rate limiting", outcome: "done", result: "Done." });
  registry.clearSession(session.id);
  assert.equal(registry.historyOf("webshop"), "No finished tasks recorded for webshop.");
});

test("clearing a session drops its worker conversation", () => {
  const registry = freshRegistry();
  const session = registry.activeSession("webshop");
  registry.updateSession(session.id, { claudeSessionId: "abc" });
  registry.clearSession(session.id);
  assert.equal(registry.session(session.id).claudeSessionId, undefined);
});

test("clearing a session keeps it open under its number", () => {
  const registry = freshRegistry();
  const second = registry.createSession("webshop");
  registry.clearSession(second.id);
  assert.equal(registry.sessionByNumber("webshop", 2).id, second.id);
});

test("a session's worker conversation survives a restart", () => {
  const registry = freshRegistry();
  registry.updateSession(registry.activeSession("webshop").id, { claudeSessionId: "abc" });
  assert.equal(new Registry({ webshop: "personal" }).activeSession("webshop").claudeSessionId, "abc");
});

test("a registry saved before sessions becomes one session per project", () => {
  const dir = freshStateDir();
  const legacy = { webshop: { name: "webshop", profile: "work", sessionId: "abc", status: "done", costUsd: 1, history: [], queued: [] } };
  writeFileSync(join(dir, "registry.json"), JSON.stringify(legacy));
  const session = new Registry({ webshop: "personal" }).activeSession("webshop");
  assert.deepEqual([session.claudeSessionId, session.status, session.costUsd], ["abc", "done", 1]);
});
