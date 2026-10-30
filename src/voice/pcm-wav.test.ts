import { test } from "node:test";
import assert from "node:assert/strict";
import { SAMPLE_RATE_HZ, wavFromPcm } from "./pcm-wav.js";

const PCM = Buffer.alloc(320, 1);
const HEADER_BYTES = 44;

test("pcm wav: the samples follow a 44-byte header", () => {
  assert.deepEqual(wavFromPcm(PCM).subarray(HEADER_BYTES), PCM);
});

test("pcm wav: the header names a RIFF WAVE file", () => {
  const wav = wavFromPcm(PCM);
  assert.equal(`${wav.toString("ascii", 0, 4)}${wav.toString("ascii", 8, 12)}`, "RIFFWAVE");
});

test("pcm wav: the data chunk's size is the samples' size", () => {
  assert.equal(wavFromPcm(PCM).readUInt32LE(40), PCM.length);
});

test("pcm wav: the RIFF size counts everything after its own field", () => {
  assert.equal(wavFromPcm(PCM).readUInt32LE(4), HEADER_BYTES - 8 + PCM.length);
});

test("pcm wav: the sample rate is the one whisper.cpp expects", () => {
  assert.equal(wavFromPcm(PCM).readUInt32LE(24), SAMPLE_RATE_HZ);
});
