import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppEvent } from "../../events/app-events.js";
import { app, notices, voice } from "../support/harness.js";
import { countSince, mark, pause } from "../support/helpers.js";

const { core, workers } = app;
const TASK = "turn: Both helpers are running; I'll wait for their reports.\nsleep: 50";
const AFTER_THE_END_MS = 300;

test("a worker that ends a turn while its helpers still run is reported finished once, with its final note", async () => {
  const ended: AppEvent[] = [];
  const listen = (e: AppEvent): void => {
    if ((e.kind === "task_done" || e.kind === "task_failed") && e.task === TASK) ended.push(e);
  };
  core.events.on("event", listen);
  workers.intake.run("dbadmin", TASK);
  while (!ended.length) await pause(20);
  await pause(AFTER_THE_END_MS);
  core.events.off("event", listen);
  assert.deepEqual(
    ended.map((e) => (e.kind === "task_done" ? e.result : e.kind)),
    ["Finished. slept 50."],
  );
});

/** A failed dbadmin task, emitted while you are talking so its announcement waits in the queue. */
function failWhileTalking(task: string): void {
  const session = core.registry.activeSession("dbadmin");
  const subject = { project: "dbadmin", session: session.id, label: "dbadmin", sessionNumber: session.number };
  voice.listening = true;
  core.events.emitEvent({ kind: "task_failed", ...subject, task, error: "boom" });
}

test("closing a task's pop-up before its announcement is said drops the announcement", async () => {
  const i = mark();
  failWhileTalking("Rotate the backup keys");
  notices.shown.at(-1)!.click("close");
  voice.listening = false;
  await pause(AFTER_THE_END_MS);
  assert.equal(countSince(i, /failed: Rotate the backup keys/), 0);
});

test("any button on a task's pop-up stops speech, as the talk key does", () => {
  const stopsBefore = voice.stops;
  failWhileTalking("Prune the old snapshots");
  notices.shown.at(-1)!.click("session");
  voice.listening = false;
  assert.equal(voice.stops, stopsBefore + 1);
});
