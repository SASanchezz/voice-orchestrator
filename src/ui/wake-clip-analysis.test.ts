import { test } from "node:test";
import assert from "node:assert/strict";
import { analyseClip, isMuchQuieter } from "./wake-clip-analysis.js";

const RATE = 16_000;
const SPOKEN = 0.4;

/** One second of quiet, then `level` for the given share of the second, then quiet again. */
function clip(level: number, from: number, to: number): Float32Array {
  const samples = new Float32Array(RATE);
  for (let index = Math.round(from * RATE); index < Math.round(to * RATE); index++) {
    samples[index] = index % 2 === 0 ? level : -level;
  }
  return samples;
}

test("wake clip analysis: a word said clearly in the middle has no flags", () => {
  assert.deepEqual(analyseClip(clip(SPOKEN, 0.3, 0.7), RATE, true).flags, []);
});

test("wake clip analysis: a take far quieter than your usual one is much quieter", () => {
  assert.equal(isMuchQuieter(0.02, [0.1, 0.12, 0.02, 0.09]), true);
});

test("wake clip analysis: a take a little quieter than usual isn't flagged", () => {
  assert.equal(isMuchQuieter(0.07, [0.1, 0.12, 0.07, 0.09]), false);
});

test("wake clip analysis: the peak is the loudest sample", () => {
  assert.equal(analyseClip(clip(SPOKEN, 0.3, 0.7), RATE, true).peak, Math.fround(SPOKEN));
});

test("wake clip analysis: samples at full scale are clipped", () => {
  assert.deepEqual(analyseClip(clip(1, 0.3, 0.7), RATE, true).flags, ["clipped"]);
});

test("wake clip analysis: a wake word still loud at the end is cut off", () => {
  assert.deepEqual(analyseClip(clip(SPOKEN, 0.5, 1), RATE, true).flags, ["cut off"]);
});

test("wake clip analysis: other talk running to the end isn't cut off", () => {
  assert.deepEqual(analyseClip(clip(SPOKEN, 0.5, 1), RATE, false).flags, []);
});

test("wake clip analysis: the waveform has 64 bars", () => {
  assert.equal(analyseClip(clip(SPOKEN, 0.3, 0.7), RATE, true).bars.length, 64);
});

test("wake clip analysis: the bars follow where the word is", () => {
  const { bars } = analyseClip(clip(SPOKEN, 0.5, 1), RATE, true);
  assert.deepEqual([bars[0], bars[63]], [0, SPOKEN].map(Math.fround));
});
