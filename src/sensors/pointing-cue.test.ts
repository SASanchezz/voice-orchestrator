import { test } from "node:test";
import assert from "node:assert/strict";
import { POINTING_NOTE, PointingCue } from "./pointing-cue.js";

const WORDS = "what is this?";
const POINTED = `${WORDS}\n${POINTING_NOTE}`;

test("pointing cue: words said without pointing are left as they are", () => {
  const cue = new PointingCue();
  cue.talkStarted();
  assert.equal(cue.annotate(WORDS), WORDS);
});

test("pointing cue: pointing while talking adds the note", () => {
  const cue = new PointingCue();
  cue.talkStarted();
  cue.pointStarted();
  cue.pointEnded();
  assert.equal(cue.annotate(WORDS), POINTED);
});

test("pointing cue: still pointing when talk starts adds the note", () => {
  const cue = new PointingCue();
  cue.pointStarted();
  cue.talkStarted();
  assert.equal(cue.annotate(WORDS), POINTED);
});

test("pointing cue: pointing that ended before the talk started adds nothing", () => {
  const cue = new PointingCue();
  cue.pointStarted();
  cue.pointEnded();
  cue.talkStarted();
  assert.equal(cue.annotate(WORDS), WORDS);
});
