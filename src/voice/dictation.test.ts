import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Dictation, UnavailableDictation } from "./dictation.js";

/** Stands in for sox: streams silence to its stdout until it is stopped. */
const FAKE_RECORDER = '#!/bin/sh\ntrap "exit 0" INT\nwhile true; do head -c 3200 /dev/zero; sleep 0.05; done\n';
const WORDS = "add a dark mode toggle";
const WORDS_SO_FAR = "add a dark";
const WAV_HEADER_BYTES = 44;

/** Stands in for whisper.cpp: hears `words` at the end and `WORDS_SO_FAR` meanwhile, and remembers what it was given. */
class FakeTranscriber {
  heard: string[] = [];
  heardBytes: number[] = [];

  constructor(private words: string) {}

  transcribeOrNothing(wav: string): Promise<string> {
    this.heard.push(wav);
    this.heardBytes.push(readFileSync(wav).length);
    return Promise.resolve(this.words);
  }

  previewOrNothing(): Promise<string> {
    return Promise.resolve(WORDS_SO_FAR);
  }
}

function dictation(words = WORDS): { mic: Dictation; transcriber: FakeTranscriber; dir: string } {
  const dir = mkdtempSync(join(tmpdir(), "vo-dictation-"));
  const recordBin = join(dir, "rec");
  writeFileSync(recordBin, FAKE_RECORDER);
  chmodSync(recordBin, 0o755);
  const transcriber = new FakeTranscriber(words);
  return { mic: new Dictation(recordBin, transcriber, dir), transcriber, dir };
}

test("dictation: finishing gives the words that were said", async () => {
  const { mic } = dictation();
  mic.start();
  assert.equal(await mic.finish(), WORDS);
});

test("dictation: the words so far come while it records", async () => {
  const { mic } = dictation();
  mic.start();
  const heard: unknown[] = await once(mic, "words");
  await mic.cancel();
  assert.deepEqual(heard, [WORDS_SO_FAR]);
});

test("dictation: the recorded audio is what gets transcribed", async () => {
  const { mic, transcriber } = dictation();
  mic.start();
  await once(mic, "words");
  await mic.finish();
  assert.ok(transcriber.heardBytes[0] > WAV_HEADER_BYTES);
});

test("dictation: the recording is transcribed from its file in the given folder", async () => {
  const { mic, transcriber, dir } = dictation();
  mic.start();
  await mic.finish();
  assert.deepEqual(transcriber.heard, [join(dir, "dictation-1.wav")]);
});

test("dictation: the recording is deleted once transcribed", async () => {
  const { mic, transcriber } = dictation();
  mic.start();
  await mic.finish();
  assert.equal(existsSync(transcriber.heard[0]), false);
});

test("dictation: silence is an error, so nothing empty is written", async () => {
  const { mic } = dictation("");
  mic.start();
  await assert.rejects(mic.finish(), /Nothing was heard/);
});

test("dictation: finishing without recording is an error", async () => {
  const { mic } = dictation();
  await assert.rejects(mic.finish(), /isn't recording/);
});

test("dictation: a cancelled recording is never transcribed", async () => {
  const { mic, transcriber } = dictation();
  mic.start();
  await mic.cancel();
  assert.deepEqual(transcriber.heard, []);
});

test("dictation: starting again drops the recording a closed page left running, keeping the new one", async () => {
  const { mic, transcriber, dir } = dictation();
  mic.start();
  mic.start();
  await mic.finish();
  assert.deepEqual(transcriber.heard, [join(dir, "dictation-2.wav")]);
});

test("dictation: text mode has no mic to start", () => {
  assert.throws(() => new UnavailableDictation().start(), /no mic/);
});
