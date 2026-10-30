import { test } from "node:test";
import assert from "node:assert/strict";
import { app, uiToken, uiUrl, voice } from "../support/harness.js";
import type { AppEvent } from "../../events/app-events.js";
import { brain } from "../support/fake-operator.js";
import { countSince, feedHas, firstChunk, mark, pause } from "../support/helpers.js";

const { core, operator, ui, workers } = app;

/** Runs a short acme-web task and returns once its end was announced. */
async function finishAcmeWebTask(): Promise<void> {
  const ended = taskDoneIn("acme-web");
  workers.intake.run("acme-web", "sleep: 10");
  await ended;
  await pause(100);
}

function taskDoneIn(project: string): Promise<void> {
  return new Promise((ok) => {
    const listener = (e: AppEvent) => {
      if (e.kind !== "task_done" || e.project !== project) return;
      core.events.off("event", listener);
      ok();
    };
    core.events.on("event", listener);
  });
}

const operatorReplies = (): number => ui.feed.recent().filter((e) => e.kind === "orchestrator").length;

test("a finished task is announced without a model turn", async () => {
  const before = operatorReplies();
  await finishAcmeWebTask();
  assert.equal(operatorReplies(), before);
});

test("a finished task's closing note reaches the model with the next message", async () => {
  await finishAcmeWebTask();
  const i = mark();
  voice.say("status");
  await voice.heard(/acme-web/, i);
  assert.ok(brain.notesSeen.some((n) => /^\[NOTICE\] acme-web.* finished its task\. .*closing note: Finished/.test(n)));
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
