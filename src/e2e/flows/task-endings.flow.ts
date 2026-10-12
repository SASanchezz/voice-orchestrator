import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppEvent } from "../../events/app-events.js";
import { app } from "../support/harness.js";
import { pause } from "../support/helpers.js";

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
