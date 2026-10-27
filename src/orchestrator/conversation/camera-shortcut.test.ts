import { test } from "node:test";
import assert from "node:assert/strict";
import type { CameraFrame, CameraSource } from "../../camera/camera-source.js";
import type { FrameDescriber } from "../../camera/frame-describer.js";
import { CameraShortcut } from "./camera-shortcut.js";
import type { Turn } from "./turn-taker.js";

const FRAME: CameraFrame = { data: "ZmFrZQ==", mimeType: "image/jpeg" };
const LOCAL_ANSWER = "Yes, you're on the couch, waving.";

const turnFor = (utterance: string): Turn => ({
  message: `[USER] ${utterance}`,
  heard: `user: ${utterance}`,
  utterance,
  aloud: true,
  mentionWaiting: false,
});

const camera = (latest: () => Promise<CameraFrame>): CameraSource => ({
  capture: () => {},
  latest,
  releaseShotsBefore: () => {},
});
const workingCamera = camera(async () => FRAME);
const camerasOff = camera(async () => {
  throw new Error("Gestures are off");
});

const answerer: FrameDescriber = { describe: async () => LOCAL_ANSWER };

/** A shortcut over fake turns; `byModel` and `answered` list what went to the model and what was answered without it. */
function shortcut(source: CameraSource = workingCamera) {
  const byModel: string[] = [];
  const answered: string[] = [];
  const turns = {
    take: async (turn: Turn) => {
      byModel.push(turn.message);
      return "the model's reply";
    },
    takeAnswered: async (_turn: Turn, reply: string) => {
      answered.push(reply);
      return reply;
    },
    showLine: () => {},
  };
  return { shortcut: new CameraShortcut(source, answerer, turns), byModel, answered };
}

test("camera shortcut: a quick camera question is answered by the local model", async () => {
  const { shortcut: turns, answered } = shortcut();
  await turns.take(turnFor("can you see me now"));
  assert.deepEqual(answered, [LOCAL_ANSWER]);
});

test("camera shortcut: a quick camera question skips the operator's model", async () => {
  const { shortcut: turns, byModel } = shortcut();
  await turns.take(turnFor("can you see me now"));
  assert.deepEqual(byModel, []);
});

test("camera shortcut: any other message goes to the operator's model", async () => {
  const { shortcut: turns, byModel } = shortcut();
  await turns.take(turnFor("run the tests on webshop"));
  assert.deepEqual(byModel, ["[USER] run the tests on webshop"]);
});

test("camera shortcut: without a camera frame the question goes to the operator's model", async () => {
  const { shortcut: turns, byModel } = shortcut(camerasOff);
  await turns.take(turnFor("can you see me now"));
  assert.deepEqual(byModel, ["[USER] can you see me now"]);
});
