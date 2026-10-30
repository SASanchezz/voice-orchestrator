import { existsSync, readFileSync, statSync } from "node:fs";
import type { AudioSoFar } from "./live-preview.js";
import { BYTES_PER_SECOND } from "./pcm-wav.js";

const MS_PER_SECOND = 1000;
const DATA_CHUNK_ID = "data";
/** A chunk's id and its size field, before its body. */
const CHUNK_HEAD_BYTES = 8;
/** The header sox writes for 16-bit mono PCM, until the "data" chunk is found. */
const USUAL_HEADER_BYTES = 44;
const BYTES_PER_SAMPLE = 2;

/** A WAV file sox is still writing, read as it grows, so what was said so far can be transcribed meanwhile. */
export class GrowingWav implements AudioSoFar {
  constructor(private wav: string) {}

  /** The samples written so far; nothing before sox has made the file. */
  audio(): Buffer {
    if (!existsSync(this.wav)) return Buffer.alloc(0);
    return wholeSamples(samplesOf(readFileSync(this.wav)));
  }

  get audioBytes(): number {
    if (!existsSync(this.wav)) return 0;
    return Math.max(0, statSync(this.wav).size - USUAL_HEADER_BYTES);
  }

  get audioMs(): number {
    return (this.audioBytes / BYTES_PER_SECOND) * MS_PER_SECOND;
  }
}

/** What follows the "data" chunk's head; the header's sizes aren't final until sox stops, so they are ignored. */
function samplesOf(file: Buffer): Buffer {
  const dataAt = file.indexOf(DATA_CHUNK_ID, 0, "ascii");
  if (dataAt < 0) return Buffer.alloc(0);
  return file.subarray(dataAt + CHUNK_HEAD_BYTES);
}

/** A sample cut in half by a write still under way is left out. */
function wholeSamples(samples: Buffer): Buffer {
  return samples.subarray(0, samples.length - (samples.length % BYTES_PER_SAMPLE));
}
