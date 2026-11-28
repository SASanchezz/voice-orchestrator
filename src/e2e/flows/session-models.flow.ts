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
  const [queued] = acmeWebSession().queued;
  assert.deepEqual([queued?.instruction, queued?.model], ["sleep: 10", "sonnet"]);
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

const lastAcmeWebEffort = () => workerCalls.filter((call) => call.cwd === acmeWeb && !call.summary).at(-1)?.effort;

function chooseEffort(effort?: string): Promise<Response> {
  return uiPost(`/api/sessions/${acmeWebSession().id}/effort`, { effort });
}

test("session efforts: an effort picked in the chat is saved on the session", async () => {
  const res = await chooseEffort("high");
  assert.deepEqual([res.status, acmeWebSession().effort], [200, "high"]);
});

test("session efforts: the session's chat says which effort its next tasks use", async () => {
  await chatHas(acmeWebSession().id, /Effort: High, from the next task on\./);
});

test("session efforts: a task typed to the session thinks with its effort", async () => {
  await typeTask("sleep: 10");
  await untilIdle("acme-web");
  assert.equal(lastAcmeWebEffort(), "high");
});

test("session efforts: an effort not on the list is refused", async () => {
  assert.equal((await chooseEffort("extreme")).status, 400);
});

test("session efforts: no effort puts the session back on Claude Code's default", async () => {
  await chooseEffort();
  assert.equal(acmeWebSession().effort, undefined);
});
