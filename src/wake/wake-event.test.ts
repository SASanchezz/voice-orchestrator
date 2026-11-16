import { test } from "node:test";
import assert from "node:assert/strict";
import { readWakeLine } from "./wake-event.js";

test("wake event: a wake line carries its score", () => {
  assert.deepEqual(readWakeLine('{"type":"wake","score":0.91}').data, { type: "wake", score: 0.91 });
});

test("wake event: ready names the model", () => {
  assert.deepEqual(readWakeLine('{"type":"ready","model":"oracle"}').data, { type: "ready", model: "oracle" });
});

test("wake event: the end of speech is read", () => {
  assert.equal(readWakeLine('{"type":"speech_end"}').data?.type, "speech_end");
});

test("wake event: the wake word said again is read", () => {
  assert.equal(readWakeLine('{"type":"stop_word"}').data?.type, "stop_word");
});

test("wake event: a wake without a score is refused", () => {
  assert.equal(readWakeLine('{"type":"wake"}').success, false);
});

test("wake event: an unknown type is refused", () => {
  assert.equal(readWakeLine('{"type":"gesture"}').success, false);
});

test("wake event: a line that isn't JSON is refused", () => {
  assert.equal(readWakeLine("Traceback (most recent call last):").success, false);
});
