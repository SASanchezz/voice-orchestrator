import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { ScreenshotFolder } from "../screen/screenshot-folder.js";
import { SensorCamera } from "./sensor-camera.js";

const JPEG_BYTES = "jpg";
const JPEG_BASE64 = Buffer.from(JPEG_BYTES).toString("base64");

/** Stands in for the gesture sensor: each snapshot is written at once, and counted. */
class FakeSnapshots {
  taken: string[] = [];

  async take(path: string): Promise<void> {
    this.taken.push(path);
    writeFileSync(path, JPEG_BYTES);
  }
}

/** Gestures are off: the sensor isn't running. */
class CameraOff {
  async take(): Promise<void> {
    throw new Error("The camera is off");
  }
}

function emptyDir(): string {
  return mkdtempSync(join(tmpdir(), "vo-camera-"));
}

function folder(): ScreenshotFolder {
  return new ScreenshotFolder(emptyDir());
}

/** Lets the deletions queued on finished writes run. */
const settled = (): Promise<void> => new Promise((done) => setImmediate(done));

test("sensor camera: the model gets the frame as a base64 JPEG", async () => {
  const camera = new SensorCamera(new FakeSnapshots(), folder());
  assert.deepEqual(await camera.latest(), { data: JPEG_BASE64, mimeType: "image/jpeg" });
});

test("sensor camera: the frame captured on the key press is the one handed over", async () => {
  const snapshots = new FakeSnapshots();
  const camera = new SensorCamera(snapshots, folder());
  camera.capture();
  await camera.latest();
  assert.equal(snapshots.taken.length, 1);
});

test("sensor camera: the frames go to the camera folder", async () => {
  const snapshots = new FakeSnapshots();
  const dir = emptyDir();
  await new SensorCamera(snapshots, new ScreenshotFolder(dir)).latest();
  assert.equal(dirname(snapshots.taken[0]), dir);
});

test("sensor camera: with the camera off, asking for the frame says so", async () => {
  const camera = new SensorCamera(new CameraOff(), folder());
  camera.capture();
  await assert.rejects(camera.latest(), /camera is off/);
});

test("sensor camera: a frame is deleted once the turn after it ends", async () => {
  const snapshots = new FakeSnapshots();
  const camera = new SensorCamera(snapshots, folder());
  await camera.latest();
  camera.releaseShotsBefore(Date.now() + 1);
  await settled();
  assert.equal(existsSync(snapshots.taken[0]), false);
});
