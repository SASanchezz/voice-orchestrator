import { test } from "node:test";
import assert from "node:assert/strict";
import { POINTING_NOTE } from "../../sensors/pointing-cue.js";
import { isQuickCameraQuestion } from "./camera-question.js";

const pointingAt = (words: string): string => `${words}\n${POINTING_NOTE}`;

test("camera question: asking whether you are seen is one", () => {
  assert.equal(isQuickCameraQuestion("Can you see me now?"), true);
});

test("camera question: asking what you hold is one, with a curly apostrophe too", () => {
  assert.equal(isQuickCameraQuestion("Tell me what I’m holding"), true);
});

test("camera question: what is in your hand is one", () => {
  assert.equal(isQuickCameraQuestion("what's in my hand"), true);
});

test("camera question: 'what is this' while pointing is one", () => {
  assert.equal(isQuickCameraQuestion(pointingAt("What is this?")), true);
});

test("camera question: 'what is this' without pointing is not one", () => {
  assert.equal(isQuickCameraQuestion("What is this?"), false);
});

test("camera question: seeing something on screen is not one", () => {
  assert.equal(isQuickCameraQuestion("Can you see the build log?"), false);
});

test("camera question: a camera setting is not one", () => {
  assert.equal(isQuickCameraQuestion("turn off the camera gestures"), false);
});

test("camera question: a long message is not one, even with a camera phrase", () => {
  const long =
    "can you see me and then open webshop and ask it to add the resend countdown to sign-up and run all tests";
  assert.equal(isQuickCameraQuestion(long), false);
});
