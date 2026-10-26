import { test } from "node:test";
import assert from "node:assert/strict";
import { CAMERA_OFF, type SnapshotRequest } from "./gesture-process.js";
import { SensorSnapshots } from "./sensor-snapshots.js";

const PATH = "/state/camera/shot.jpg";
const QUICK_TIMEOUT_MS = 10;

/** Stands in for the running sensor; it writes down what it was asked. */
class FakeSensor {
  requests: SnapshotRequest[] = [];

  requestSnapshot(request: SnapshotRequest): void {
    this.requests.push(request);
  }
}

class StoppedSensor {
  requestSnapshot(): void {
    throw new Error(CAMERA_OFF);
  }
}

function attached(answerTimeoutMs = QUICK_TIMEOUT_MS): { snapshots: SensorSnapshots; sensor: FakeSensor } {
  const snapshots = new SensorSnapshots(answerTimeoutMs);
  const sensor = new FakeSensor();
  snapshots.attach(sensor);
  return { snapshots, sensor };
}

/** Asks for a snapshot whose outcome the test doesn't look at. */
function ask(snapshots: SensorSnapshots): void {
  snapshots.take(PATH).catch(() => {});
}

test("sensor snapshots: the sensor is asked for a snapshot at the path", () => {
  const { snapshots, sensor } = attached();
  ask(snapshots);
  assert.equal(sensor.requests[0].path, PATH);
});

test("sensor snapshots: a snapshot is taken once the sensor answers it", async () => {
  const { snapshots, sensor } = attached();
  const taken = snapshots.take(PATH);
  snapshots.answered({ type: "snapshot", id: sensor.requests[0].id, ok: true, path: PATH });
  await assert.doesNotReject(taken);
});

test("sensor snapshots: a snapshot the sensor couldn't write fails with its reason", async () => {
  const { snapshots, sensor } = attached();
  const taken = snapshots.take(PATH);
  snapshots.answered({ type: "snapshot", id: sensor.requests[0].id, ok: false, message: "disk full" });
  await assert.rejects(taken, /disk full/);
});

test("sensor snapshots: each snapshot is told apart by its id", () => {
  const { snapshots, sensor } = attached();
  ask(snapshots);
  ask(snapshots);
  assert.notEqual(sensor.requests[0].id, sensor.requests[1].id);
});

test("sensor snapshots: a sensor that stops fails the snapshots it hasn't answered", async () => {
  const { snapshots } = attached();
  const taken = snapshots.take(PATH);
  snapshots.sensorStopped();
  await assert.rejects(taken, /camera stopped/);
});

test("sensor snapshots: a sensor that never answers fails the snapshot in time", async () => {
  const { snapshots } = attached();
  await assert.rejects(snapshots.take(PATH), /in time/);
});

test("sensor snapshots: before any sensor is built, the camera is off", async () => {
  await assert.rejects(new SensorSnapshots().take(PATH), { message: CAMERA_OFF });
});

test("sensor snapshots: a stopped sensor's refusal reaches the caller", async () => {
  const snapshots = new SensorSnapshots();
  snapshots.attach(new StoppedSensor());
  await assert.rejects(snapshots.take(PATH), { message: CAMERA_OFF });
});
