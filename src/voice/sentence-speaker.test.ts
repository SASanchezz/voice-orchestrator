import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SpeechSynthesizer } from "./kokoro-synthesizer.js";
import { SentenceSpeaker } from "./sentence-speaker.js";
import type { AudioPlayer } from "./wav-player.js";

/** Writes each sentence's text as its "audio", so playing a file tells which sentence it was. */
const textSynthesizer: SpeechSynthesizer = {
  synthesize: async (sentence, wavPath) => writeFileSync(wavPath, sentence),
};

/** Notes what it played, and the files that existed while it played. */
class RecordingPlayer implements AudioPlayer {
  played: string[] = [];
  filesWhilePlaying: number[] = [];
  onPlay: () => void = () => {};

  async play(path: string): Promise<void> {
    this.played.push(readFileSync(path, "utf8"));
    this.filesWhilePlaying.push(readdirSync(join(path, "..")).length);
    this.onPlay();
  }

  stop(): void {}
}

function speakerWith(player: AudioPlayer): { speaker: SentenceSpeaker; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "sentence-speaker-"));
  return { speaker: new SentenceSpeaker(textSynthesizer, player, dir), dir };
}

test("sentence speaker: plays each sentence in order", async () => {
  const player = new RecordingPlayer();
  await speakerWith(player).speaker.speak("Done. Tests pass! Push it?");
  assert.deepEqual(player.played, ["Done.", "Tests pass!", "Push it?"]);
});

test("sentence speaker: renders the next sentence while the current one plays", async () => {
  const player = new RecordingPlayer();
  await speakerWith(player).speaker.speak("One. Two. Three.");
  assert.deepEqual(player.filesWhilePlaying, [2, 2, 1]);
});

test("sentence speaker: deletes every audio file once done", async () => {
  const { speaker, dir } = speakerWith(new RecordingPlayer());
  await speaker.speak("One. Two.");
  assert.deepEqual(readdirSync(dir), []);
});

test("sentence speaker: stopping skips the sentences not yet played", async () => {
  const player = new RecordingPlayer();
  const { speaker } = speakerWith(player);
  player.onPlay = () => speaker.stop();
  await speaker.speak("One. Two. Three.");
  assert.deepEqual(player.played, ["One."]);
});

test("sentence speaker: stopping leaves no audio files behind", async () => {
  const player = new RecordingPlayer();
  const { speaker, dir } = speakerWith(player);
  player.onPlay = () => speaker.stop();
  await speaker.speak("One. Two. Three.");
  assert.deepEqual(readdirSync(dir), []);
});

test("sentence speaker: a failed sentence is reported, not thrown", async () => {
  const failing: SpeechSynthesizer = { synthesize: () => Promise.reject(new Error("model broke")) };
  const speaker = new SentenceSpeaker(failing, new RecordingPlayer(), mkdtempSync(join(tmpdir(), "sentence-speaker-")));
  await assert.doesNotReject(speaker.speak("Hello."));
});
