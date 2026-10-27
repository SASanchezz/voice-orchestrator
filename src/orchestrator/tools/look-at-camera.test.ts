import { test } from "node:test";
import assert from "node:assert/strict";
import type { CameraFrame, CameraSource } from "../../camera/camera-source.js";
import type { FrameDescriber } from "../../camera/frame-describer.js";
import { lookAtCamera } from "./assistant-tools.js";
import { DescribedView, PictureView } from "./camera-views.js";
import type { ToolResult } from "./tool-kit.js";

const FRAME: CameraFrame = { data: "ZmFrZQ==", mimeType: "image/jpeg" };
const QUESTION = { question: "what is this?" };

/** A camera that hands over FRAME, or fails as it does while Gestures are off. */
class FakeCamera implements CameraSource {
  constructor(private frame: () => Promise<CameraFrame>) {}

  capture(): void {}

  latest(): Promise<CameraFrame> {
    return this.frame();
  }

  releaseShotsBefore(): void {}
}

/** A local model that sees "a red mug", and remembers what it was asked. */
class FakeDescriber implements FrameDescriber {
  questions: string[] = [];

  async describe(_frame: CameraFrame, question: string): Promise<string> {
    this.questions.push(question);
    return "a red mug";
  }
}

const workingCamera = new FakeCamera(async () => FRAME);
const cameraOff = new FakeCamera(async () => {
  throw new Error("The camera is off");
});

const claudeLooks = () => lookAtCamera(new PictureView(workingCamera));
const localModelLooks = (describer = new FakeDescriber()) => lookAtCamera(new DescribedView(workingCamera, describer));

function textOf(result: ToolResult): string {
  return result.content.map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

test("look_at_camera: the model sees the camera frame", async () => {
  const result = await claudeLooks().call(QUESTION);
  assert.deepEqual(result.content[1], { type: "image", ...FRAME });
});

test("look_at_camera: with the camera off, the model reads why", async () => {
  const result = await lookAtCamera(new PictureView(cameraOff)).call(QUESTION);
  assert.deepEqual(result.content, [{ type: "text", text: "Error: The camera is off" }]);
});

test("look_at_camera: with a local describer, the model reads its description", async () => {
  const result = await localModelLooks().call(QUESTION);
  assert.match(textOf(result), /a red mug/);
});

test("look_at_camera: with a local describer, no image reaches the model", async () => {
  const { content } = await localModelLooks().call(QUESTION);
  const hasImage = content.some((part) => part.type === "image");
  assert.equal(hasImage, false);
});

test("look_at_camera: with Gestures off, the local vision model isn't asked at all", async () => {
  const describer = new FakeDescriber();
  await lookAtCamera(new DescribedView(cameraOff, describer)).call(QUESTION);
  assert.deepEqual(describer.questions, []);
});

test("look_at_camera: the local describer is asked the user's question", async () => {
  const describer = new FakeDescriber();
  await localModelLooks(describer).call(QUESTION);
  assert.deepEqual(describer.questions, [QUESTION.question]);
});

test("look_at_camera: with a local describer, the model can still ask for the picture", async () => {
  const result = await localModelLooks().call({ ...QUESTION, picture: true });
  assert.deepEqual(result.content[1], { type: "image", ...FRAME });
});
