import { test } from "node:test";
import assert from "node:assert/strict";
import type { CameraFrame, CameraSource } from "../../camera/camera-source.js";
import { lookAtCamera } from "./assistant-tools.js";

const FRAME: CameraFrame = { data: "ZmFrZQ==", mimeType: "image/jpeg" };

/** A camera that hands over FRAME, or fails as it does while Gestures are off. */
class FakeCamera implements CameraSource {
  constructor(private frame: () => Promise<CameraFrame>) {}

  capture(): void {}

  latest(): Promise<CameraFrame> {
    return this.frame();
  }

  releaseShotsBefore(): void {}
}

const workingCamera = new FakeCamera(async () => FRAME);
const cameraOff = new FakeCamera(async () => {
  throw new Error("The camera is off");
});

test("look_at_camera: the model sees the camera frame", async () => {
  const result = await lookAtCamera(workingCamera).call({});
  assert.deepEqual(result.content[1], { type: "image", ...FRAME });
});

test("look_at_camera: with the camera off, the model reads why", async () => {
  const result = await lookAtCamera(cameraOff).call({});
  assert.deepEqual(result.content, [{ type: "text", text: "Error: The camera is off" }]);
});
