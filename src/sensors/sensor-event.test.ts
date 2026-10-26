import { test } from "node:test";
import assert from "node:assert/strict";
import { readSensorLine } from "./sensor-event.js";

const START =
  '{"type":"gesture","phase":"start","name":"open_palm","hand":"right","confidence":0.93,"ts":1761400000123}';

test("sensor event: a gesture line is read with its fields", () => {
  const parsed = readSensorLine(START);
  assert.deepEqual(parsed.data, {
    type: "gesture",
    phase: "start",
    name: "open_palm",
    hand: "right",
    confidence: 0.93,
    ts: 1761400000123,
  });
});

test("sensor event: a line that isn't JSON is rejected", () => {
  assert.equal(readSensorLine("Traceback (most recent call last):").success, false);
});

test("sensor event: an unknown event type is rejected", () => {
  assert.equal(readSensorLine('{"type":"frame","ts":1}').success, false);
});

test("sensor event: a gesture without a name is rejected", () => {
  assert.equal(readSensorLine('{"type":"gesture","phase":"end","hand":"left","ts":1}').success, false);
});

test("sensor event: a snapshot answer is read with its path", () => {
  const parsed = readSensorLine('{"type":"snapshot","id":"abc","path":"/state/camera/abc.jpg","ok":true}');
  assert.deepEqual(parsed.data, { type: "snapshot", id: "abc", path: "/state/camera/abc.jpg", ok: true });
});

test("sensor event: a failed snapshot is read with its reason", () => {
  const parsed = readSensorLine('{"type":"snapshot","id":"abc","ok":false,"message":"disk full"}');
  assert.deepEqual(parsed.data, { type: "snapshot", id: "abc", ok: false, message: "disk full" });
});

test("sensor event: a failed snapshot without a reason is rejected", () => {
  assert.equal(readSensorLine('{"type":"snapshot","id":"abc","ok":false}').success, false);
});
