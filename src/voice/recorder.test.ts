import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import { startRecorder, stopRecorder } from "./recorder.js";

/** Stands in for sox: ignores the recording arguments and runs until stopped. */
const ENDLESS_BIN = "yes";
const UNUSED_WAV = "unused.wav";
const NO_LIMIT = setTimeout(() => {}, 0);

const exitHooks = (): number => process.listenerCount("exit");

test("a running recorder is killed if the app exits", async () => {
  const before = exitHooks();
  const recorder = startRecorder(ENDLESS_BIN, UNUSED_WAV);
  await once(recorder, "spawn");
  const during = exitHooks();
  await stopRecorder({ recorder, limit: NO_LIMIT });
  assert.equal(during, before + 1);
});

test("a stopped recorder no longer hooks the app's exit", async () => {
  const before = exitHooks();
  const recorder = startRecorder(ENDLESS_BIN, UNUSED_WAV);
  await once(recorder, "spawn");
  await stopRecorder({ recorder, limit: NO_LIMIT });
  assert.equal(exitHooks(), before);
});
