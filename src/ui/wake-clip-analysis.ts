// What the wake word review shows for a recording: its waveform, and what may make it a poor take. No imports, so the
// server (Node, for tests) and the page (browser) both compile it.

/** What may make a recording a poor take, worth listening to first. */
export type ClipFlag = "quiet" | "clipped" | "cut off";

export interface ClipAnalysis {
  /** The loudest sample in each slice of the clip, 0 to 1: the waveform's bars. */
  bars: number[];
  /** The loudest sample of all, 0 to 1. */
  peak: number;
  /** Clipped or cut off; whether it's quiet depends on your other takes (`isMuchQuieter`). */
  flags: ClipFlag[];
}

const WAVEFORM_BARS = 64;
/**
 * A take whose peak is under this share of your usual one (the median) is likely too far from the mic, or the word
 * wasn't said; mics differ too much for a fixed level.
 */
const QUIET_SHARE = 0.35;
const HALF = 2;
/** A sample this close to full scale is distorted; a few in a row are a clipped recording. */
const CLIPPED_LEVEL = 0.99;
const CLIPPED_SAMPLES = 8;
const EDGE_MS = 120;
const MS_PER_SECOND = 1000;
/** Still this loud at the very end, relative to the loudest moment, the word ran past the recording. */
const CUT_OFF_SHARE = 0.35;

/**
 * `samples` from -1 to 1. Only a wake word recording can be cut off: other talk runs on past its end by design.
 */
export function analyseClip(samples: Float32Array, sampleRate: number, isWakeWord: boolean): ClipAnalysis {
  const flags: ClipFlag[] = [];
  if (countClipped(samples) >= CLIPPED_SAMPLES) flags.push("clipped");
  if (isWakeWord && endsMidWord(samples, sampleRate)) flags.push("cut off");
  return { bars: barsOf(samples), peak: peakOf(samples), flags };
}

/** Much quieter than your usual take among `peaks`. */
export function isMuchQuieter(peak: number, peaks: number[]): boolean {
  return peak < medianOf(peaks) * QUIET_SHARE;
}

function medianOf(values: number[]): number {
  const sorted = values.toSorted((first, second) => first - second);
  const middle = Math.floor(sorted.length / HALF);
  if (sorted.length % HALF === 1) return sorted[middle];
  return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / HALF;
}

function peakOf(samples: Float32Array): number {
  let peak = 0;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  return peak;
}

function countClipped(samples: Float32Array): number {
  let count = 0;
  for (const sample of samples) if (Math.abs(sample) >= CLIPPED_LEVEL) count++;
  return count;
}

function endsMidWord(samples: Float32Array, sampleRate: number): boolean {
  const edge = Math.max(1, Math.round((sampleRate * EDGE_MS) / MS_PER_SECOND));
  const levels = sliceLevels(samples, edge);
  const loudest = Math.max(...levels);
  return levels.length > 1 && loudest > 0 && (levels.at(-1) ?? 0) >= loudest * CUT_OFF_SHARE;
}

/** How loud (RMS) each `size`-sample slice is. */
function sliceLevels(samples: Float32Array, size: number): number[] {
  const levels: number[] = [];
  for (let start = 0; start + size <= samples.length; start += size) {
    levels.push(rmsOf(samples.subarray(start, start + size)));
  }
  return levels;
}

function rmsOf(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.sqrt(sum / samples.length);
}

function barsOf(samples: Float32Array): number[] {
  const size = Math.max(1, Math.floor(samples.length / WAVEFORM_BARS));
  const bars: number[] = [];
  for (let start = 0; start + size <= samples.length && bars.length < WAVEFORM_BARS; start += size) {
    bars.push(peakOf(samples.subarray(start, start + size)));
  }
  return bars;
}
