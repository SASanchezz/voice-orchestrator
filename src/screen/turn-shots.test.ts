import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScreenshotFolder } from "./screenshot-folder.js";
import { TurnShots } from "./turn-shots.js";

const TURN_START = Date.parse("2026-10-14T09:00:00.000Z");

function folder(): ScreenshotFolder {
  return new ScreenshotFolder(mkdtempSync(join(tmpdir(), "vo-turn-shots-")));
}

/** A snapshot taken `offsetMs` from the turn's start, already written. */
function writtenShot(shots: TurnShots, where: ScreenshotFolder, offsetMs: number): string {
  const takenAt = TURN_START + offsetMs;
  const file = where.pathFor(new Date(takenAt));
  writeFileSync(file, "jpg");
  shots.add({ file, takenAt, written: Promise.resolve() });
  return file;
}

/** Lets the deletions queued on finished writes run. */
const settled = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("turn shots: a snapshot taken before the turn is deleted when it ends", async () => {
  const where = folder();
  const shots = new TurnShots(where);
  const file = writtenShot(shots, where, -5_000);
  shots.releaseBefore(TURN_START);
  await settled();
  assert.equal(existsSync(file), false);
});

test("turn shots: a snapshot taken during the turn waits for the next one", async () => {
  const where = folder();
  const shots = new TurnShots(where);
  const file = writtenShot(shots, where, 2_000);
  shots.releaseBefore(TURN_START);
  await settled();
  assert.equal(existsSync(file), true);
});

test("turn shots: a snapshot kept by one turn is deleted when the next one ends", async () => {
  const where = folder();
  const shots = new TurnShots(where);
  const file = writtenShot(shots, where, 2_000);
  shots.releaseBefore(TURN_START);
  shots.releaseBefore(TURN_START + 10_000);
  await settled();
  assert.equal(existsSync(file), false);
});

test("turn shots: a snapshot still being written is deleted once it is written", async () => {
  const where = folder();
  const shots = new TurnShots(where);
  const file = where.pathFor(new Date(TURN_START - 1_000));
  const written = new Promise<void>((resolve) => setTimeout(resolve, 5));
  shots.add({ file, takenAt: TURN_START - 1_000, written });
  shots.releaseBefore(TURN_START);
  writeFileSync(file, "jpg");
  await written;
  await settled();
  assert.equal(existsSync(file), false);
});

test("turn shots: a snapshot whose write failed is cleaned up without an error", async () => {
  const where = folder();
  const shots = new TurnShots(where);
  const file = where.pathFor(new Date(TURN_START - 1_000));
  writeFileSync(file, "half a jpg");
  shots.add({ file, takenAt: TURN_START - 1_000, written: Promise.reject(new Error("screencapture failed")) });
  shots.releaseBefore(TURN_START);
  await settled();
  assert.equal(existsSync(file), false);
});
