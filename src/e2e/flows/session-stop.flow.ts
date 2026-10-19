import { test } from "node:test";
import assert from "node:assert/strict";
import { app, voice } from "../support/harness.js";
import { mark, pause, uiPost } from "../support/helpers.js";

const { core } = app;
const sessionOfAcmeWeb = (number: number) => core.registry.sessionByNumber("acme-web", number);

test("session stop: two acme-web sessions work at once, session 1 with a task queued", async () => {
  let i = mark();
  voice.say("new session acme-web");
  await voice.heard(/acme-web session 2; it is now active/, i);
  voice.say("in acme-web do:\nsleep: 10000");
  await voice.heard(/Started on acme-web session 2/, i);
  i = mark();
  voice.say("switch acme-web to 1");
  await voice.heard(/acme-web session 1 is now active/, i);
  voice.say("in acme-web do:\nsleep: 10000");
  voice.say("in acme-web do:\nrun: echo kept > kept.txt");
  await voice.heard(/queued as #1/, i);
  assert.deepEqual([sessionOfAcmeWeb(1).status, sessionOfAcmeWeb(2).status], ["running", "running"]);
});

test("session stop: stopping a session that isn't active stops only that one", async () => {
  const i = mark();
  voice.say("stop acme-web session 2");
  await voice.heard(/Stopping acme-web session 2; its queue was cleared/, i);
  await pause(100);
  assert.deepEqual([sessionOfAcmeWeb(2).status, sessionOfAcmeWeb(1).status], ["stopped", "running"]);
});

test("session stop: the other session keeps its queue", () => {
  assert.deepEqual(sessionOfAcmeWeb(1).queued, ["run: echo kept > kept.txt"]);
});

test("session stop: a session number that doesn't exist is an error to read out", async () => {
  const i = mark();
  voice.say("stop acme-web session 9");
  await voice.heard(/Error: /, i);
  assert.equal(sessionOfAcmeWeb(1).status, "running");
});

test("ui: any running session can be stopped by click", async () => {
  const res = await uiPost(`/api/sessions/${sessionOfAcmeWeb(1).id}/stop`, {});
  await pause(100);
  assert.deepEqual([res.status, sessionOfAcmeWeb(1).status, sessionOfAcmeWeb(1).queued], [200, "stopped", []]);
});

test("session stop: the extra session is closed again", async () => {
  const i = mark();
  voice.say("close acme-web session 2");
  await voice.heard(/Closed acme-web session 2/, i);
  assert.equal(core.sessions.sessionsOf("acme-web").length, 1);
});
