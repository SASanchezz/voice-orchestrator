import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { AppEvent } from "../../events/app-events.js";
import { brain, operatorSessions } from "../support/fake-operator.js";
import { app, screen, voice } from "../support/harness.js";
import { countSince, heardTimes, mark, nextOperatorSession, pause } from "../support/helpers.js";
import { acmeWeb, cfg } from "../support/sandbox.js";

const { core, permissions, workers } = app;

test("notifications wait until the user has finished speaking", async () => {
  const i = mark();
  voice.say("in dbadmin do:\nsleep: 200");
  await voice.heard(/Started on dbadmin/, i);
  voice.listening = true; // key held, or words still being transcribed
  await pause(500); // task finished meanwhile
  assert.ok(
    !voice.spoken.slice(i).some((s) => /^dbadmin session \d+ done: /.test(s)),
    "not spoken while user is talking",
  );
  voice.listening = false;
  await voice.heard(/^dbadmin session \d+ done: /, i);
});

test("stop a long task: queue cleared, status stopped, nothing left pending", async () => {
  let i = mark();
  voice.say("in acme-web do:\nsleep: 10000");
  await voice.heard(/Started on acme-web/, i);
  voice.say("in acme-web do:\nrun: echo queued > q.txt");
  await voice.heard(/queued as #1/, i);
  i = mark();
  voice.say("stop acme-web");
  await voice.heard(/Stopping acme-web; its queue was cleared/, i);
  await pause(100);
  assert.equal(core.registry.activeSession("acme-web").status, "stopped");
  assert.equal(existsSync(join(acmeWeb, "q.txt")), false, "queued task never ran");
  assert.equal(permissions.views.list().length, 0);
});

test("starting to talk snaps the screen", () => {
  const before = screen.captures;
  voice.say("status");
  assert.equal(screen.captures, before + 1);
});

test("look_at_screen hands the screenshot to the model", async () => {
  const i = mark();
  voice.say("what's on my screen");
  assert.match(await voice.heard(/screen when they started speaking/, i), /\[image\]/);
});

test("hourly context reset carries a handoff into the new session", async () => {
  cfg.orchestrator.resetMinutes = 0;
  const before = operatorSessions.length;
  const i = mark();
  voice.say("status");
  await voice.heard(/dbadmin \[personal\]: done[\s\S]*acme-web \[work\]: stopped/, i);
  await nextOperatorSession(operatorSessions, before);
  const s = operatorSessions.at(-1)!;
  assert.equal(operatorSessions.length, before + 1);
  assert.match(s.systemPrompt, /Handoff: user wants to be told when acme-web finishes/);
  assert.match(s.systemPrompt, /acme-web \[work\]/);
  assert.equal(s.account, "personal");
  cfg.orchestrator.resetMinutes = 60;
});

test("two permission requests are asked one at a time", async () => {
  const i = mark();
  voice.listening = true; // both arrive while the user is talking
  workers.intake.run("dbadmin", "run: echo a");
  workers.intake.run("acme-web", "run: echo b");
  while (permissions.views.list().length < 2) await pause(20);
  voice.listening = false;
  assert.match(await voice.heard(/wants approval/, i), /\(1 more waiting\)/);
  await pause(300);
  assert.equal(countSince(i, /wants approval/), 1, "second request waits for an answer to the first");
  voice.say("deny");
  await heardTimes(/wants approval/, 2, i);
  voice.say("deny");
  await heardTimes(/^\S+ session \d+ done: /, 2, i);
});

test("after 'want details?', the next notification waits for the answer window", async () => {
  cfg.orchestrator.answerWindowSeconds = 1;
  const i = mark();
  workers.intake.run("dbadmin", "sleep: 10");
  workers.intake.run("acme-web", "sleep: 10");
  await heardTimes(/^\S+ session \d+ done: /, 1, i);
  await pause(400);
  assert.equal(countSince(i, /^\S+ session \d+ done: /), 1, "held inside the window");
  await heardTimes(/^\S+ session \d+ done: /, 2, i);
  cfg.orchestrator.answerWindowSeconds = 0;
});

test("speaking ends the answer window early", async () => {
  cfg.orchestrator.answerWindowSeconds = 60;
  const i = mark();
  workers.intake.run("dbadmin", "sleep: 10");
  workers.intake.run("acme-web", "sleep: 10");
  await heardTimes(/^\S+ session \d+ done: /, 1, i);
  voice.say("status");
  await heardTimes(/^\S+ session \d+ done: /, 2, i);
  cfg.orchestrator.answerWindowSeconds = 0;
});

test("a finished task is announced with its session number and a few words of the task", async () => {
  const before = mark();
  voice.say("status"); // answers the last "want details?", so the next announcement isn't held back
  await voice.heard(/dbadmin \[personal\]/, before);
  const i = mark();
  workers.intake.run("dbadmin", "Please add a resend countdown on sign-up.\nsleep: 5");
  const number = core.registry.activeSession("dbadmin").number;
  await voice.heard(new RegExp(`^dbadmin session ${number} done: add a resend countdown on sign-up$`), i);
});

test("a finished-task event carries the task text and session number", async () => {
  const ended = new Promise<AppEvent>((ok) => core.events.once("event", ok));
  workers.intake.run("dbadmin", "sleep: 5");
  const event = await ended;
  assert.deepEqual(event.kind === "task_done" && [event.task, event.sessionNumber], [
    "sleep: 5",
    core.registry.activeSession("dbadmin").number,
  ]);
});

test("a failed task is announced with its session number and a few words of the task", async () => {
  const i = mark();
  const session = core.registry.activeSession("dbadmin");
  const subject = { project: "dbadmin", session: session.id, label: "dbadmin", sessionNumber: session.number };
  core.events.emitEvent({ kind: "task_failed", ...subject, task: "Fix the login redirect loop", error: "boom" });
  await voice.heard(new RegExp(`^dbadmin session ${session.number} failed: Fix the login redirect loop$`), i);
});

test("the assistant's acknowledgment is spoken before its tool calls finish", async () => {
  const i = mark();
  voice.say("slow: check webshop");
  await voice.heard(/^On it: check webshop\.$/, i);
  brain.finishSlowTurn();
  await voice.heard(/^Done with that\.$/, i);
});

test("a reply spoken piece by piece is not spoken again whole", async () => {
  const i = mark();
  voice.say("slow: check dbadmin");
  await voice.heard(/^On it: check dbadmin\.$/, i);
  brain.finishSlowTurn();
  await voice.heard(/^Done with that\.$/, i);
  await pause(200);
  assert.equal(countSince(i, /On it: check dbadmin\. Done with that\./), 0);
});
