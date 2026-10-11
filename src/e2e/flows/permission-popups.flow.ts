import { test } from "node:test";
import assert from "node:assert/strict";
import { app, popups, voice } from "../support/harness.js";
import { countSince, heardTimes, mark, pause } from "../support/helpers.js";

const { permissions, workers } = app;

test("a request answered in its pop-up closes it and is never asked aloud", async () => {
  const i = mark();
  voice.listening = true; // the question waits until the user stops talking
  workers.intake.run("dbadmin", "run: echo popup");
  while (!permissions.views.list().length) await pause(20);
  popups.latest().click(true);
  voice.listening = false;
  await heardTimes(/^dbadmin session \d+ done: /, 1, i);
  assert.deepEqual([popups.latest().closed, countSince(i, /wants approval/)], [true, 0]);
});
