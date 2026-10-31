// Reading the lines of a project's file for the Review view, which shows what a diff leaves out and where a name is
// defined.

import { lstat, readFile, stat } from "node:fs/promises";
import type { LineExpansionView } from "../ui/change-views.js";

/** Beyond this, a file would only slow the page down; VS Code still opens it. */
export const MAX_FILE_BYTES = 262_144; // 256 KiB

/** A diff was loaded before its file last changed, so its line numbers no longer fit the file. */
export class StaleFileError extends Error {}

/** A symlink could point anywhere on this Mac, so only regular files are read. Throws on anything else. */
export async function readLines(file: string): Promise<string[]> {
  const { size } = await lstatRegular(file);
  if (size > MAX_FILE_BYTES) throw new Error(`${file} is too large to read`);
  const text = await readFile(file, "utf8");
  if (text.includes("\0")) throw new Error(`${file} is binary`);
  return text ? text.replace(/\n$/, "").split("\n") : [];
}

async function lstatRegular(file: string): Promise<{ size: number }> {
  const stats = await lstat(file);
  if (!stats.isFile()) throw new Error(`${file} is not a regular file`);
  return stats;
}

/** Undefined when the file can't be read, as a deleted, binary or very large one can't. */
export async function expansionOf(file: string): Promise<LineExpansionView | undefined> {
  try {
    const fingerprint = await fingerprintOf(file);
    return { lineCount: (await readLines(file)).length, fingerprint };
  } catch {
    return undefined;
  }
}

/** Size and time are enough to notice a file changing again, without reading it. */
export async function fingerprintOf(file: string): Promise<string> {
  try {
    const { mtimeMs, size } = await stat(file);
    return `${mtimeMs}-${size}`;
  } catch {
    return "gone";
  }
}
