import { test } from "node:test";
import assert from "node:assert/strict";
import { app, voice } from "../support/harness.js";
import { mark, pause, uiPost } from "../support/helpers.js";

const { core } = app;
const sessionOfAcmeWeb = (number: number) => core.registry.sessionByNumber("acme-web", number);
const instructionsQueuedIn = (number: number) => sessionOfAcmeWeb(number).queued.map((item) => item.instruction);

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
  await voice.heard(/Stopping acme-web session 2; anything queued waits until you resume it/, i);
  await pause(100);
  assert.deepEqual([sessionOfAcmeWeb(2).status, sessionOfAcmeWeb(1).status], ["stopped", "running"]);
});

test("session stop: the other session keeps its queue", () => {
  assert.deepEqual(instructionsQueuedIn(1), ["run: echo kept > kept.txt"]);
});

test("session stop: a session number that doesn't exist is an error to read out", async () => {
  const i = mark();
  voice.say("stop acme-web session 9");
  await voice.heard(/Error: /, i);
  assert.equal(sessionOfAcmeWeb(1).status, "running");
});

test("ui: any running session can be stopped by click, keeping its queue paused", async () => {
  const res = await uiPost(`/api/sessions/${sessionOfAcmeWeb(1).id}/stop`, {});
  await pause(100);
  const { status, queuePaused } = sessionOfAcmeWeb(1);
  assert.deepEqual([res.status, status, instructionsQueuedIn(1).length, queuePaused], [200, "stopped", 1, true]);
});

test("ui: a paused queue is cleared by click", async () => {
  const res = await uiPost(`/api/sessions/${sessionOfAcmeWeb(1).id}/queue/clear`, {});
  assert.deepEqual([res.status, instructionsQueuedIn(1), sessionOfAcmeWeb(1).queuePaused], [200, [], undefined]);
});

test("session stop: the extra session is closed again", async () => {
  const i = mark();
  voice.say("close acme-web session 2");
  await voice.heard(/Closed acme-web session 2/, i);
  assert.equal(core.sessions.sessionsOf("acme-web").length, 1);
});
