import { test } from "node:test";
import assert from "node:assert/strict";
import { app, voice } from "../support/harness.js";
import { mark, uiPost } from "../support/helpers.js";

const { core } = app;
const sessionOfAcmeWeb = (number: number) => core.registry.sessionByNumber("acme-web", number);

test("session routing: a new session starts its first task itself", async () => {
  const i = mark();
  voice.say("new session acme-web doing:\nsleep: 10000");
  await voice.heard(/Opened acme-web session 2; it is now active\. Started on acme-web session 2/, i);
});

test("session routing: a task for a numbered session goes there after a click makes another active", async () => {
  await uiPost(`/api/sessions/${sessionOfAcmeWeb(1).id}/activate`, {});
  const i = mark();
  voice.say("in acme-web session 2 do:\nrun: echo second > second.txt");
  await voice.heard(/acme-web session 2 is busy; queued as #1/, i);
  assert.deepEqual(sessionOfAcmeWeb(2).queued, ["run: echo second > second.txt"]);
});

test("session routing: a task without a number goes to the active session", async () => {
  const i = mark();
  voice.say("in acme-web do:\nsleep: 10000");
  await voice.heard(/Started on acme-web session 1/, i);
});

test("session routing: the sessions are stopped and the extra one closed again", async () => {
  const i = mark();
  voice.say("stop acme-web session 1");
  await voice.heard(/Stopping acme-web session 1/, i);
  voice.say("close acme-web session 2");
  await voice.heard(/Closed acme-web session 2/, i);
  assert.equal(core.sessions.sessionsOf("acme-web").length, 1);
});
