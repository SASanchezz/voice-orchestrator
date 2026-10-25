import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sleep } from "../shared/sleep.js";
import { GestureProcess, type RestartBackoff } from "./gesture-process.js";
import type { GestureEvent } from "./sensor-event.js";
import type { SensorListener } from "./sensor-router.js";

const RESTART_DELAY_MS = 10;
const WAIT_STEP_MS = 20;
const WAIT_MAX_MS = 5000;
const SETTLE_MS = 300;

const START = '{"type":"gesture","phase":"start","name":"open_palm","hand":"right","confidence":0.9,"ts":1}';
const END = '{"type":"gesture","phase":"end","name":"open_palm","hand":"right","heldMs":500,"ts":2}';
const READY = '{"type":"ready","recognizer":"canned"}';
const STAY_RUNNING = "setInterval(() => {}, 1000);";

class RecordingListener implements SensorListener {
  gestures: GestureEvent[] = [];
  stops = 0;

  receive(gesture: GestureEvent): void {
    this.gestures.push(gesture);
  }

  sensorStopped(): void {
    this.stops++;
  }
}

const quickBackoff: RestartBackoff = { nextDelay: () => RESTART_DELAY_MS, reset: () => {} };

/** A sensor that is a Node script printing `lines`, then running `then`. */
function fakeSensor(lines: string[], then: string): { sensor: GestureProcess; heard: RecordingListener } {
  const script = join(mkdtempSync(join(tmpdir(), "vo-sensor-")), "sensor.mjs");
  const prints = lines.map((line) => `console.log(${JSON.stringify(line)});`).join("\n");
  writeFileSync(script, `${prints}\n${then}\n`);
  const heard = new RecordingListener();
  const sensor = new GestureProcess({ bin: process.execPath, args: [script] }, heard, quickBackoff);
  return { sensor, heard };
}

async function until(done: () => boolean): Promise<void> {
  const end = Date.now() + WAIT_MAX_MS;
  while (!done() && Date.now() < end) await sleep(WAIT_STEP_MS);
}

test("gesture process: the sensor's gesture lines reach the listener", async () => {
  const { sensor, heard } = fakeSensor([READY, START, END], STAY_RUNNING);
  sensor.start();
  await until(() => heard.gestures.length === 2);
  sensor.stop();
  assert.deepEqual(
    heard.gestures.map((gesture) => gesture.phase),
    ["start", "end"],
  );
});

test("gesture process: a line it can't read is skipped", async () => {
  const { sensor, heard } = fakeSensor([START, "not json at all", END], STAY_RUNNING);
  sensor.start();
  await until(() => heard.gestures.length === 2);
  sensor.stop();
  assert.equal(heard.gestures.length, 2);
});

test("gesture process: a sensor that crashes is started again", async () => {
  const { sensor, heard } = fakeSensor([START], "process.exit(1);");
  sensor.start();
  await until(() => heard.gestures.length >= 2);
  sensor.stop();
  assert.ok(heard.gestures.length >= 2);
});

test("gesture process: the listener hears when the sensor dies", async () => {
  const { sensor, heard } = fakeSensor([START], "process.exit(1);");
  sensor.start();
  await until(() => heard.stops > 0);
  sensor.stop();
  assert.ok(heard.stops > 0);
});

test("gesture process: a stopped sensor isn't started again", async () => {
  const { sensor, heard } = fakeSensor([START], STAY_RUNNING);
  sensor.start();
  await until(() => heard.gestures.length === 1);
  sensor.stop();
  await sleep(SETTLE_MS);
  assert.equal(heard.gestures.length, 1);
});
