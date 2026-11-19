import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { CommandRunner } from "../secrets/keychain.js";
import { DiskFileFinder } from "./disk-file-finder.js";

const VIDEO = "clip.mp4";
const VIDEO_BYTES = Buffer.from("video bytes");

function tempFolder(): string {
  return mkdtempSync(join(tmpdir(), "disk-file-finder-"));
}

function fileIn(folder: string, bytes: Buffer = VIDEO_BYTES): string {
  mkdirSync(folder, { recursive: true });
  const path = join(folder, VIDEO);
  writeFileSync(path, bytes);
  return path;
}

function spotlightPrinting(...paths: string[]): CommandRunner {
  return async () => ({ stdout: `${paths.join("\n")}\n` });
}

const spotlightOff: CommandRunner = async () => {
  throw new Error("Spotlight is off");
};

function video(): { name: string; size: number; modified: number } {
  return { name: VIDEO, size: VIDEO_BYTES.length, modified: Date.now() };
}

test("disk file finder: finds the file Spotlight lists with the same name and size", async () => {
  const path = fileIn(join(tempFolder(), "deep", "inside"));
  const found = await new DiskFileFinder(spotlightPrinting(path), []).find(video());
  assert.equal(found.path, path);
});

test("disk file finder: looks in the usual folders when Spotlight fails", async () => {
  const downloads = tempFolder();
  const path = fileIn(downloads);
  const found = await new DiskFileFinder(spotlightOff, [downloads]).find(video());
  assert.equal(found.path, path);
});

test("disk file finder: skips a file with the same name but another size", async () => {
  const other = fileIn(tempFolder(), Buffer.from("another size entirely"));
  const finder = new DiskFileFinder(spotlightPrinting(other), []);
  await assert.rejects(finder.find(video()), /Couldn't find clip\.mp4/);
});
