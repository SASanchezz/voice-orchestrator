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
