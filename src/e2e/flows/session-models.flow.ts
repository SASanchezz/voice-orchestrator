import { test } from "node:test";
import assert from "node:assert/strict";
import { workerCalls } from "../support/fake-worker.js";
import { app } from "../support/harness.js";
import { chatHas, untilIdle, uiPost } from "../support/helpers.js";
import { acmeWeb } from "../support/sandbox.js";

const { core } = app;
const acmeWebSession = () => core.registry.activeSession("acme-web");
const lastAcmeWebModel = () => workerCalls.filter((call) => call.cwd === acmeWeb && !call.summary).at(-1)?.model;

function typeTask(instruction: string, model?: string): Promise<Response> {
  return uiPost(`/api/sessions/${acmeWebSession().id}/tasks`, { instruction, model });
}

function chooseModel(model?: string): Promise<Response> {
  return uiPost(`/api/sessions/${acmeWebSession().id}/model`, { model });
}

test("session models: a model picked from the tab's menu is saved on the session", async () => {
  const res = await chooseModel("opus");
  assert.deepEqual([res.status, acmeWebSession().model], [200, "opus"]);
});

test("session models: the session's chat says which model its next tasks use", async () => {
  await chatHas(acmeWebSession().id, /Model: Opus, from the next task on\./);
});

test("session models: a task typed to the session runs on its model", async () => {
  await typeTask("sleep: 10");
  await untilIdle("acme-web");
  assert.equal(lastAcmeWebModel(), "opus");
});

test("session models: a task sent with its own model runs on that model", async () => {
  await typeTask("sleep: 10", "haiku");
  await untilIdle("acme-web");
  assert.equal(lastAcmeWebModel(), "haiku");
});

test("session models: a task's own model leaves the session's model as it was", () => {
  assert.equal(acmeWebSession().model, "opus");
});

test("session models: a queued task keeps its own model until it runs", async () => {
  await typeTask("sleep: 300");
  await typeTask("sleep: 10", "sonnet");
  assert.deepEqual(acmeWebSession().queued, [{ instruction: "sleep: 10", model: "sonnet" }]);
  await untilIdle("acme-web");
  assert.equal(lastAcmeWebModel(), "sonnet");
});

test("session models: a model not on the list is refused", async () => {
  assert.equal((await typeTask("sleep: 10", "gpt-4")).status, 400);
});

test("session models: no model puts the session back on its project's model", async () => {
  await chooseModel();
  assert.equal(acmeWebSession().model, undefined);
});
