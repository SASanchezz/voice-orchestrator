import { test } from "node:test";
import assert from "node:assert/strict";
import { TextVoice } from "./text-voice.js";
import { VoiceWithDictation } from "./voice-with-dictation.js";

function voiceWhileRecording(recording: boolean): VoiceWithDictation {
  return new VoiceWithDictation(new TextVoice(), { isRecording: () => recording });
}

test("voice with dictation: recording with the mic button counts as talking", () => {
  assert.equal(voiceWhileRecording(true).isListening(), true);
});

test("voice with dictation: quiet when neither the talk key nor the mic button is on", () => {
  assert.equal(voiceWhileRecording(false).isListening(), false);
});

test("voice with dictation: the mic button doesn't change the talk key's input state", () => {
  assert.equal(voiceWhileRecording(true).inputState(), "idle");
});
