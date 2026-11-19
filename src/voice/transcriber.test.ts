import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { testConfig } from "../testing/test-config.js";
import { Transcriber } from "./transcriber.js";

/** A stand-in whisper-cli that prints the arguments it was given as the transcript. */
function echoingWhisper(): string {
  const bin = join(mkdtempSync(join(tmpdir(), "vo-whisper-")), "whisper-cli");
  writeFileSync(bin, '#!/bin/sh\necho "$@"\n');
  chmodSync(bin, 0o755);
  return bin;
}

function transcriberWith(vocabulary: string[]): Transcriber {
  const { voice } = testConfig({});
  return new Transcriber({ ...voice, whisperBin: echoingWhisper(), vocabulary });
}

test("the vocabulary reaches whisper as its initial prompt", async () => {
  const words = await transcriberWith(["Prewins", "Casini"]).previewOrNothing("take.wav");
  assert.match(words, /--prompt Prewins, Casini\.$/);
});

test("without a vocabulary whisper gets no prompt", async () => {
  const words = await transcriberWith([]).previewOrNothing("take.wav");
  assert.doesNotMatch(words, /--prompt/);
});
