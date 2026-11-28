import { test } from "node:test";
import assert from "node:assert/strict";
import { app, voice } from "../support/harness.js";
import { chatText, mark, pause, uiPost } from "../support/helpers.js";

const { core } = app;
const acmeWebSession = () => core.registry.activeSession("acme-web");
const queuedInAcmeWeb = () => acmeWebSession().queued.map((item) => item.instruction);
const queuePath = (action: string) => `/api/sessions/${acmeWebSession().id}/queue/${action}`;
const firstTaskPath = (action: string) => queuePath(`${acmeWebSession().queued[0]?.id ?? "none"}/${action}`);

test("queue: a busy session queues three tasks behind its running one", async () => {
  const i = mark();
  voice.say("in acme-web do:\nsleep: 10000");
  await voice.heard(/Started on acme-web/, i);
  for (const name of ["first", "second", "third"]) voice.say(`in acme-web do:\nrun: echo ${name} > ${name}.txt`);
  await voice.heard(/queued as #3/, i);
  assert.equal(queuedInAcmeWeb().length, 3);
});

test("queue: a queued task is not in the session's chat until it runs", () => {
  assert.doesNotMatch(chatText(acmeWebSession().id), /echo first/);
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
  assert.deepEqual([acmeWebSession().status, queuedInAcmeWeb().length], ["running", 2]);
});

test("queue: editing one by voice keeps its place", async () => {
  const i = mark();
  voice.say("change #2 in acme-web to: run: echo third edited > third.txt");
  await voice.heard(/Changed #2 run: echo third edited/, i);
  assert.deepEqual(queuedInAcmeWeb(), ["run: echo first > first.txt", "run: echo third edited > third.txt"]);
});

test("queue: a task moved up by voice runs next", async () => {
  const i = mark();
  voice.say("run #2 next in acme-web");
  await voice.heard(/runs next on acme-web/, i);
  assert.equal(queuedInAcmeWeb()[0], "run: echo third edited > third.txt");
});

test("queue: dropping one by words from its instruction", async () => {
  const i = mark();
  voice.say('drop "third" from acme-web');
  await voice.heard(/Removed #1 run: echo third/, i);
  assert.deepEqual(queuedInAcmeWeb(), ["run: echo first > first.txt"]);
});

test("queue: words matching nothing remove nothing", async () => {
  const i = mark();
  voice.say('drop "footer" from acme-web');
  await voice.heard(/No queued task mentions "footer"/, i);
  assert.equal(queuedInAcmeWeb().length, 1);
});

test("ui: the edit button changes the task it showed", async () => {
  const res = await uiPost(firstTaskPath("edit"), { instruction: "run: echo edited > first.txt" });
  assert.deepEqual([res.status, queuedInAcmeWeb()], [200, ["run: echo edited > first.txt"]]);
});

test("ui: an empty edit changes nothing", async () => {
  const res = await uiPost(firstTaskPath("edit"), { instruction: "  " });
  assert.deepEqual([res.status, queuedInAcmeWeb()], [400, ["run: echo edited > first.txt"]]);
});

test("ui: the remove button drops the queued task it showed", async () => {
  const res = await uiPost(firstTaskPath("remove"), {});
  assert.deepEqual([res.status, queuedInAcmeWeb()], [200, []]);
});

test("ui: a remove button for a task that left the queue removes nothing", async () => {
  const res = await uiPost(queuePath("gone/remove"), {});
  assert.notEqual(res.status, 200);
});

test("queue: stopping keeps what is queued, paused", async () => {
  const i = mark();
  voice.say("in acme-web do:\nsleep: 10000");
  await voice.heard(/queued as #1/, i);
  voice.say("stop acme-web");
  await voice.heard(/Stopping acme-web; anything queued waits until you resume it/, i);
  await pause(100);
  const { status, queuePaused } = acmeWebSession();
  assert.deepEqual([status, queuedInAcmeWeb(), queuePaused], ["stopped", ["sleep: 10000"], true]);
});

test("queue: resuming the paused queue starts its #1, which leaves the queue", async () => {
  const i = mark();
  voice.say("resume the queue of acme-web");
  await voice.heard(/Resumed acme-web's queue; 1 to go/, i);
  await pause(100);
  assert.deepEqual([acmeWebSession().task, queuedInAcmeWeb()], ["sleep: 10000", []]);
});

test("queue: a resumed task shows in the session's chat once it runs", () => {
  assert.match(chatText(acmeWebSession().id), /sleep: 10000/);
});

test("queue: stopping afterwards ends the running task", async () => {
  const i = mark();
  voice.say("stop acme-web");
  await voice.heard(/Stopping acme-web/, i);
  await pause(100);
  assert.equal(acmeWebSession().status, "stopped");
});
