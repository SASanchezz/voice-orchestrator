import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GrowingWav } from "./growing-wav.js";
import { BYTES_PER_SECOND, wavFromPcm } from "./pcm-wav.js";

function wavPath(): string {
  return join(mkdtempSync(join(tmpdir(), "vo-growing-")), "talk.wav");
}

/** sox's file while it records: a header whose sizes are not final yet, then the samples so far. */
function writeRecordingSoFar(wav: string, samples: Buffer): void {
  writeFileSync(wav, wavFromPcm(samples));
}

test("growing wav: nothing is there before sox has made the file", () => {
  assert.equal(new GrowingWav(wavPath()).audio().length, 0);
});

test("growing wav: the samples after the header are what was said so far", () => {
  const wav = wavPath();
  const samples = Buffer.from([1, 2, 3, 4]);
  writeRecordingSoFar(wav, samples);
  assert.deepEqual(new GrowingWav(wav).audio(), samples);
});

test("growing wav: a sample cut in half by a write still under way is left out", () => {
  const wav = wavPath();
  writeRecordingSoFar(wav, Buffer.from([1, 2, 3]));
  assert.deepEqual(new GrowingWav(wav).audio(), Buffer.from([1, 2]));
});

test("growing wav: its length is counted from the samples, not the header", () => {
  const wav = wavPath();
  writeRecordingSoFar(wav, Buffer.alloc(BYTES_PER_SECOND));
  assert.equal(new GrowingWav(wav).audioMs, 1000);
});
