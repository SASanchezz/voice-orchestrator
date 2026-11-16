import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { testConfig } from "../testing/test-config.js";
import { WorkerDirectory } from "./worker-directory.js";

function sessionWithHandoff(claudeSessionId?: string) {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-directory-")));
  const { registry, projects, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const { id } = registry.activeSession("webshop");
  sessions.updateSession(id, { handoff: "Done: the timer.", claudeSessionId });
  const cfg = testConfig({ projects: { webshop: { path: "/w", profile: "personal" } } });
  return { directory: new WorkerDirectory(cfg, projects, sessions), id };
}

test("worker directory: a fresh session's first task carries its handoff", () => {
  const { directory, id } = sessionWithHandoff();
  assert.equal(directory.newTask(id, { instruction: "add tests" }).handoff, "Done: the timer.");
});

test("worker directory: once the conversation exists, the handoff isn't sent again", () => {
  const { directory, id } = sessionWithHandoff("claude-1");
  assert.equal(directory.newTask(id, { instruction: "add tests" }).handoff, undefined);
});

function directoryWithModels(sessionModel?: string) {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-directory-")));
  const { registry, projects, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const { id } = registry.activeSession("webshop");
  sessions.updateSession(id, { model: sessionModel });
  const cfg = testConfig({ projects: { webshop: { path: "/w", profile: "personal", model: "sonnet" } } });
  return { directory: new WorkerDirectory(cfg, projects, sessions), id };
}

test("worker directory: a task runs on its session's model", () => {
  const { directory, id } = directoryWithModels("opus");
  assert.equal(directory.newTask(id, { instruction: "add tests" }).model, "opus");
});

test("worker directory: a session without a model runs its tasks on the project's", () => {
  const { directory, id } = directoryWithModels();
  assert.equal(directory.newTask(id, { instruction: "add tests" }).model, "sonnet");
});

test("worker directory: a task's own model wins over its session's", () => {
  const { directory, id } = directoryWithModels("opus");
  assert.equal(directory.newTask(id, { instruction: "add tests", model: "haiku" }).model, "haiku");
});
