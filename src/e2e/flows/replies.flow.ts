import { test } from "node:test";
import assert from "node:assert/strict";
import { app, uiToken, uiUrl, voice } from "../support/harness.js";
import { countSince, feedHas, firstChunk, mark, pause } from "../support/helpers.js";

const { operator, ui, workers } = app;

/** Runs a short acme-web task and returns once the model's reply about it is in the feed. */
async function finishAcmeWebTask(): Promise<void> {
  const before = ui.feed.recent().length;
  workers.intake.run("acme-web", "sleep: 10");
  const replied = () =>
    ui.feed
      .recent()
      .slice(before)
      .some((e) => e.kind === "orchestrator" && /acme-web finished/.test(e.text));
  while (!replied()) await pause(20);
  await pause(100);
}

/** Runs a question on acme-web and waits until the assistant's answer is in the feed. */
async function answerQuestionOnAcmeWeb(): Promise<number> {
  const i = mark();
  workers.intake.run("acme-web", "question: how does login work\nsleep: 10");
  await feedHas(/Full answer: Finished/);
  return i;
}

test("a finished task's longer reply is shown, not spoken", async () => {
  const i = mark();
  await finishAcmeWebTask();
  assert.equal(countSince(i, /acme-web finished/), 0);
});

test("a worker's answer to a question is spoken briefly", async () => {
  const i = await answerQuestionOnAcmeWeb();
  await voice.heard(/^Short answer from acme-web\.$/, i);
});

test("a worker's answer's full explanation is not spoken", async () => {
  const i = await answerQuestionOnAcmeWeb();
  await voice.heard(/^Short answer from acme-web\.$/, i);
  assert.equal(countSince(i, /Full answer/), 0);
});

test("a worker's answer shows the brief and the full explanation on screen", async () => {
  await answerQuestionOnAcmeWeb();
  assert.match(ui.feed.recent().at(-1)!.text, /^Short answer from acme-web\.\n\nFull answer: Finished/);
});

test("a voice reply speaks only its part before [SCREEN]", async () => {
  const i = mark();
  voice.say("explain the queue");
  await feedHas(/In detail: the queue works step by step\./);
  assert.deepEqual(
    voice.spoken.slice(i).filter((s) => /queue/.test(s)),
    ["Briefly: the queue."],
  );
});

test("ui: in 'questions' speech mode a finished task is still announced", async () => {
  operator.orchestrator.setSpeechMode("questions");
  const i = mark();
  await finishAcmeWebTask();
  assert.equal(countSince(i, /^acme-web session \d+ done: /), 1);
  operator.orchestrator.setSpeechMode("all");
});

test("ui: in 'muted' speech mode a finished task is not announced", async () => {
  operator.orchestrator.setSpeechMode("muted");
  const i = mark();
  await finishAcmeWebTask();
  assert.equal(countSince(i, /^acme-web session \d+ done: /), 0);
  operator.orchestrator.setSpeechMode("all");
});

test("ui: live state streams to the page", async () => {
  const res = await fetch(new URL(`/api/events?token=${uiToken}`, uiUrl));
  assert.match(await firstChunk(res), /^event: state\ndata: \{"projects":\[/);
});
