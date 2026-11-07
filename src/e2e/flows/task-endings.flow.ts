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

/** A failed dbadmin task, emitted while you are talking so its announcement waits in the queue; its notice's id. */
function failWhileTalking(task: string): string {
  const session = core.registry.activeSession("dbadmin");
  const subject = { project: "dbadmin", session: session.id, label: "dbadmin", sessionNumber: session.number };
  voice.listening = true;
  core.events.emitEvent({ kind: "task_failed", ...subject, task, error: "boom" });
  return app.notices.inbox.views().at(-1)!.id;
}

test("touching a task's notice before its announcement is said drops the announcement", async () => {
  const i = mark();
  app.notices.actions.markSeen(failWhileTalking("Rotate the backup keys"));
  voice.listening = false;
  await pause(AFTER_THE_END_MS);
  assert.equal(countSince(i, /failed: Rotate the backup keys/), 0);
});

test("touching a task's notice stops speech, as the talk key does", () => {
  const stopsBefore = voice.stops;
  app.notices.actions.markSeen(failWhileTalking("Prune the old snapshots"));
  voice.listening = false;
  assert.equal(voice.stops, stopsBefore + 1);
});

test("a finished task brings up the notice panel on the notice page", async () => {
  const before = notices.shownLinks.length;
  workers.intake.run("dbadmin", "sleep: 5");
  while (notices.shownLinks.length === before) await pause(20);
  assert.match(notices.shownLinks.at(-1)!, /\/notice\?token=/);
});

test("a finished task's notice carries the worker's whole closing note", async () => {
  const task = Array.from({ length: 200 }, () => "sleep: 0").join("\n"); // "Finished. slept 0; slept 0; …"
  workers.intake.run("acme-web", task);
  while (!app.notices.inbox.views().some((n) => n.task === task)) await pause(20);
  const notice = app.notices.inbox.views().find((n) => n.task === task)!;
  assert.ok(notice.summary.length > 1200, "longer than what the assistant is passed"); // one paragraph: all summary
});
