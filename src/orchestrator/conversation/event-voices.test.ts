import { test } from "node:test";
import assert from "node:assert/strict";
import type { TaskEndEvent } from "../../events/app-events.js";
import { EventVoices } from "./event-voices.js";

const KAGGLE_DONE: TaskEndEvent = {
  kind: "task_done",
  project: "kaggle",
  session: "s1",
  label: "kaggle",
  sessionNumber: 1,
  task: "Please retrain the model.",
  result: "ok",
};

/** Event voices over a speaker that counts how often its speech was stopped. */
function voicesWithStops() {
  const speaker = { stops: 0, stopSpeaking: () => void speaker.stops++ };
  return { voices: new EventVoices(speaker), speaker };
}

test("event voices: an event keeps one voice", () => {
  const { voices } = voicesWithStops();
  assert.equal(voices.voiceOf(KAGGLE_DONE), voices.voiceOf(KAGGLE_DONE));
});

test("event voices: silencing an event stops the speech, as the talk key does", () => {
  const { voices, speaker } = voicesWithStops();
  voices.silence(KAGGLE_DONE);
  assert.equal(speaker.stops, 1);
});

test("event voices: silencing an event quiets the voice its queued input carries", () => {
  const { voices } = voicesWithStops();
  const queued = voices.voiceOf(KAGGLE_DONE);
  voices.silence(KAGGLE_DONE);
  assert.equal(queued.isSilenced(), true);
});
