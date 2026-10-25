import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { GestureMode } from "./gesture-setting.js";
import { GestureSetting } from "./gesture-setting.js";
import { GestureSwitch, UnavailableGestures, type Sensor } from "./gesture-switch.js";

/** Stands in for the camera sensor; it writes down whether it was started and stopped. */
class FakeSensor implements Sensor {
  constructor(private done: string[]) {}

  start(): void {
    this.done.push("start");
  }

  stop(): void {
    this.done.push("stop");
  }
}

function newSetting(fallback: GestureMode): GestureSetting {
  return new GestureSetting(join(mkdtempSync(join(tmpdir(), "vo-gesture-switch-")), "gestures.json"), fallback);
}

/** A switch with a fake sensor, connected as it is once the mic is ready. */
function connectedSwitch(fallback: GestureMode): { gestures: GestureSwitch; done: string[]; setting: GestureSetting } {
  const done: string[] = [];
  const setting = newSetting(fallback);
  const gestures = new GestureSwitch(setting);
  gestures.connect(() => new FakeSensor(done));
  return { gestures, done, setting };
}

test("gesture switch: on at start, the sensor starts once the mic is ready", () => {
  const { done } = connectedSwitch("on");
  assert.deepEqual(done, ["start"]);
});

test("gesture switch: off at start, the sensor is never started", () => {
  const { done } = connectedSwitch("off");
  assert.deepEqual(done, []);
});

test("gesture switch: switching off stops the sensor", () => {
  const { gestures, done } = connectedSwitch("on");
  gestures.setMode("off");
  assert.deepEqual(done, ["start", "stop"]);
});

test("gesture switch: switching on starts the sensor", () => {
  const { gestures, done } = connectedSwitch("off");
  gestures.setMode("on");
  assert.deepEqual(done, ["start"]);
});

test("gesture switch: switching on twice starts the sensor once", () => {
  const { gestures, done } = connectedSwitch("on");
  gestures.setMode("on");
  assert.deepEqual(done, ["start"]);
});

test("gesture switch: the switch is remembered", () => {
  const { gestures, setting } = connectedSwitch("on");
  gestures.setMode("off");
  assert.equal(setting.read(), "off");
});

test("gesture switch: switched on before the mic is ready, the sensor starts once it is", () => {
  const done: string[] = [];
  const gestures = new GestureSwitch(newSetting("off"));
  gestures.setMode("on");
  gestures.connect(() => new FakeSensor(done));
  assert.deepEqual(done, ["start"]);
});

test("gesture switch: the page sees the current mode", () => {
  const { gestures } = connectedSwitch("on");
  gestures.setMode("off");
  assert.equal(gestures.state, "off");
});

test("gesture switch: without a mic, gestures can't be switched on", () => {
  assert.throws(() => new UnavailableGestures().setMode("on"));
});
