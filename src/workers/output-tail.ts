import { closeSync, fstatSync, openSync, readSync } from "node:fs";

/** Enough of the end of the file to hold its last line. */
const TAIL_BYTES = 4096;
const STEP_CHARS = 120;
const ESCAPE = "\u001b";
/** Colors and cursor moves a terminal program prints. */
const TERMINAL_CODES = new RegExp(`${ESCAPE}\\[[0-9;?]*[A-Za-z]`, "g");
/** Progress bars redraw a line after a carriage return, so it ends a line too. */
const LINE_BREAK = /[\r\n]/;

/** The last line a background command printed, without terminal codes; empty when it has printed nothing yet. */
export function lastOutputLine(path: string): string {
  const lines = readTail(path).replace(TERMINAL_CODES, "").split(LINE_BREAK);
  const printed = lines.map((line) => line.trim()).filter(Boolean);
  return (printed.at(-1) ?? "").slice(0, STEP_CHARS);
}

function readTail(path: string): string {
  try {
    return readTailOf(openSync(path, "r"));
  } catch {
    return ""; // not written yet, or already cleaned up
  }
}

function readTailOf(fd: number): string {
  try {
    const size = fstatSync(fd).size;
    const length = Math.min(size, TAIL_BYTES);
    const buffer = Buffer.alloc(length);
    readSync(fd, buffer, 0, length, size - length);
    return buffer.toString("utf8");
  } finally {
    closeSync(fd);
  }
}
