import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { APP_DIR } from "./paths.js";
import { sensorsSchema } from "./sensor-config.js";

test("sensor config: gestures are off without a sensors section", () => {
  assert.equal(sensorsSchema.parse(undefined).gestures.enabled, false);
});

test("sensor config: an empty gestures key gets the defaults", () => {
  assert.deepEqual(sensorsSchema.parse({ gestures: null }).gestures.args, ["-m", "gestures", "run"]);
});

test("sensor config: a relative interpreter path is under the app's folder", () => {
  const { gestures } = sensorsSchema.parse({ gestures: { python: "venv/bin/python" } });
  assert.equal(gestures.python, resolve(APP_DIR, "venv/bin/python"));
});

test("sensor config: a wrong type is rejected", () => {
  assert.throws(() => sensorsSchema.parse({ gestures: { enabled: "yes" } }));
});

test("sensor config: without a sensors section the wake listener runs from its own venv", () => {
  const { wakeWord } = sensorsSchema.parse(undefined);
  assert.equal(wakeWord.python, resolve(APP_DIR, "sensors/wake/.venv/bin/python"));
});

test("sensor config: an empty wakeWord key runs the wake listener", () => {
  assert.deepEqual(sensorsSchema.parse({ wakeWord: null }).wakeWord.args, ["-m", "wake", "run"]);
});

test("sensor config: the wake listener's interpreter is under the app's folder", () => {
  const { wakeWord } = sensorsSchema.parse({ wakeWord: { python: "venv/bin/python" } });
  assert.equal(wakeWord.python, resolve(APP_DIR, "venv/bin/python"));
});
