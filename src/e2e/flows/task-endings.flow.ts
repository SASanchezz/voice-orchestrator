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

/** A failed dbadmin task, emitted with nothing said yet: its announcement waits in the queue. Its notice's id. */
function failTask(task: string): string {
  emitFailure(task);
  return app.notices.inbox.views().at(-1)!.id;
}

function emitFailure(task: string): void {
  const session = core.registry.activeSession("dbadmin");
  const subject = { project: "dbadmin", session: session.id, label: "dbadmin", sessionNumber: session.number };
  core.events.emitEvent({ kind: "task_failed", ...subject, task, error: "boom" });
}

test("touching a task's notice before its announcement is said drops the announcement", async () => {
  const i = mark();
  app.notices.actions.markSeen(failTask("Rotate the backup keys"));
  await pause(AFTER_THE_END_MS);
  assert.equal(countSince(i, /failed: Rotate the backup keys/), 0);
});

test("touching a task's notice stops speech, as the talk key does", () => {
  const stopsBefore = voice.stops;
  app.notices.actions.markSeen(failTask("Prune the old snapshots"));
  assert.equal(voice.stops, stopsBefore + 1);
});

test("a task that ends while you talk brings up its notice only once you stop", async () => {
  const before = notices.shownLinks.length;
  voice.listening = true;
  emitFailure("Compact the audit log");
  const shownWhileTalking = notices.shownLinks.length;
  voice.listening = false;
  while (notices.shownLinks.length === before) await pause(20);
  assert.equal(shownWhileTalking, before);
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
