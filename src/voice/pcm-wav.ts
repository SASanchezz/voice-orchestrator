/** The format sox records in and whisper.cpp expects: 16 kHz, mono, 16-bit signed little-endian. */
export const SAMPLE_RATE_HZ = 16_000;
const CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const BITS_PER_BYTE = 8;
const BYTES_PER_FRAME = CHANNELS * (BITS_PER_SAMPLE / BITS_PER_BYTE);
export const BYTES_PER_SECOND = SAMPLE_RATE_HZ * BYTES_PER_FRAME;

const PCM_FORMAT = 1;
const UINT16_BYTES = 2;
const UINT32_BYTES = 4;

/** Raw samples, as a WAV file. */
export function wavFromPcm(pcm: Buffer): Buffer {
  return chunk("RIFF", Buffer.concat([ascii("WAVE"), chunk("fmt ", sampleFormat()), chunk("data", pcm)]));
}

function sampleFormat(): Buffer {
  const fields = [uint16(PCM_FORMAT), uint16(CHANNELS), uint32(SAMPLE_RATE_HZ), uint32(BYTES_PER_SECOND)];
  return Buffer.concat([...fields, uint16(BYTES_PER_FRAME), uint16(BITS_PER_SAMPLE)]);
}

/** A RIFF chunk: its id, its body's size, its body. */
function chunk(id: string, body: Buffer): Buffer {
  return Buffer.concat([ascii(id), uint32(body.length), body]);
}

function ascii(text: string): Buffer {
  return Buffer.from(text, "ascii");
}

function uint16(value: number): Buffer {
  const bytes = Buffer.alloc(UINT16_BYTES);
  bytes.writeUInt16LE(value);
  return bytes;
}

function uint32(value: number): Buffer {
  const bytes = Buffer.alloc(UINT32_BYTES);
  bytes.writeUInt32LE(value);
  return bytes;
}
