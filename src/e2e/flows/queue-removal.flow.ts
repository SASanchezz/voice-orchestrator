import { test } from "node:test";
import assert from "node:assert/strict";
import { app, voice } from "../support/harness.js";
import { mark, uiPost } from "../support/helpers.js";

const { core } = app;
const queuedInAcmeWeb = () => core.registry.activeSession("acme-web").queued;

test("queue: a busy session queues three tasks behind its running one", async () => {
  const i = mark();
  voice.say("in acme-web do:\nsleep: 10000");
  await voice.heard(/Started on acme-web/, i);
  for (const name of ["first", "second", "third"]) voice.say(`in acme-web do:\nrun: echo ${name} > ${name}.txt`);
  await voice.heard(/queued as #3/, i);
  assert.equal(queuedInAcmeWeb().length, 3);
});

test("queue: list_queued_tasks numbers them by place", async () => {
  const i = mark();
  voice.say("queue of acme-web");
  assert.match(await voice.heard(/has 3 queued/, i), /#1 run: echo first.*#2 run: echo second.*#3 run: echo third/);
});

test("queue: dropping one by place keeps the running task and the rest", async () => {
  const i = mark();
  voice.say("drop #2 from acme-web");
  await voice.heard(/Removed #2 run: echo second/, i);
  assert.deepEqual([core.registry.activeSession("acme-web").status, queuedInAcmeWeb().length], ["running", 2]);
});

test("queue: dropping one by words from its instruction", async () => {
  const i = mark();
  voice.say('drop "third" from acme-web');
  await voice.heard(/Removed #2 run: echo third/, i);
  assert.deepEqual(queuedInAcmeWeb(), ["run: echo first > first.txt"]);
});

test("queue: words matching nothing remove nothing", async () => {
  const i = mark();
  voice.say('drop "footer" from acme-web');
  await voice.heard(/No queued task mentions "footer"/, i);
  assert.equal(queuedInAcmeWeb().length, 1);
});

test("ui: the remove button drops the queued task it showed", async () => {
  const { id } = core.registry.activeSession("acme-web");
  const res = await uiPost(`/api/sessions/${id}/queue/remove`, {
    place: 1,
    instruction: "run: echo first > first.txt",
  });
  assert.deepEqual([res.status, queuedInAcmeWeb()], [200, []]);
});

test("ui: a remove button for a task that moved removes nothing", async () => {
  const { id } = core.registry.activeSession("acme-web");
  const res = await uiPost(`/api/sessions/${id}/queue/remove`, { place: 1, instruction: "run: echo gone" });
  assert.notEqual(res.status, 200);
});

test("queue: stopping afterwards ends the running task", async () => {
  const i = mark();
  voice.say("stop acme-web");
  await voice.heard(/Stopping acme-web/, i);
});
