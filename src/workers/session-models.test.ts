import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { testConfig } from "../testing/test-config.js";
import { SessionModels } from "./session-models.js";
import { type SessionMessage, WorkerChat } from "./worker-chat.js";
import { WorkerDirectory } from "./worker-directory.js";

function sessionModels() {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-models-")));
  const { registry, projects, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const cfg = testConfig({ projects: { webshop: { path: "/w", profile: "personal", model: "sonnet" } } });
  const chat = new WorkerChat();
  const lines: string[] = [];
  chat.on("message", (message: SessionMessage) => lines.push(message.text));
  const models = new SessionModels(sessions, new WorkerDirectory(cfg, projects, sessions), chat);
  return { models, sessions, lines, id: registry.activeSession("webshop").id };
}

test("session models: a chosen model is saved on the session", () => {
  const { models, sessions, id } = sessionModels();
  models.choose(id, "opus");
  assert.equal(sessions.session(id).model, "opus");
});

test("session models: choosing one says the session now runs on it", () => {
  const { models, id } = sessionModels();
  assert.equal(models.choose(id, "opus"), "webshop now runs on Opus.");
});

test("session models: the session's chat says the model applies from the next task", () => {
  const { models, lines, id } = sessionModels();
  models.choose(id, "opus");
  assert.deepEqual(lines, ["Model: Opus, from the next task on."]);
});

test("session models: going back to the project's model drops the session's own", () => {
  const { models, sessions, id } = sessionModels();
  models.choose(id, "opus");
  models.useProjectModel(id);
  assert.equal(sessions.session(id).model, undefined);
});

test("session models: going back names the project's model", () => {
  const { models, id } = sessionModels();
  assert.equal(models.useProjectModel(id), "webshop now runs on Sonnet (the project's model).");
});

test("session models: a cleared session keeps its model", () => {
  const { models, sessions, id } = sessionModels();
  models.choose(id, "opus");
  sessions.reset(id);
  assert.equal(sessions.session(id).model, "opus");
});

test("session efforts: a chosen effort is saved on the session", () => {
  const { models, sessions, id } = sessionModels();
  models.chooseEffort(id, "xhigh");
  assert.equal(sessions.session(id).effort, "xhigh");
});

test("session efforts: choosing one says how the session now thinks", () => {
  const { models, id } = sessionModels();
  assert.equal(models.chooseEffort(id, "max"), "webshop now thinks with Max effort.");
});

test("session efforts: the session's chat says the effort applies from the next task", () => {
  const { models, lines, id } = sessionModels();
  models.chooseEffort(id, "low");
  assert.deepEqual(lines, ["Effort: Low, from the next task on."]);
});

test("session efforts: no effort drops the session's own", () => {
  const { models, sessions, id } = sessionModels();
  models.chooseEffort(id, "high");
  models.chooseEffort(id, undefined);
  assert.equal(sessions.session(id).effort, undefined);
});

test("session efforts: a cleared session keeps its effort", () => {
  const { models, sessions, id } = sessionModels();
  models.chooseEffort(id, "high");
  sessions.reset(id);
  assert.equal(sessions.session(id).effort, "high");
});
