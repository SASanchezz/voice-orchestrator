import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, symlinkSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ScreenshotFolder } from "./screenshot-folder.js";

const HOUR_MS = 3_600_000;
const TWO_HOURS_AGO = new Date(Date.now() - 2 * HOUR_MS);

function emptyDir(): string {
  return mkdtempSync(join(tmpdir(), "vo-shots-"));
}

/** A snapshot file named as the app names them, written at `writtenAt`. */
function shotIn(folder: ScreenshotFolder, takenAt: Date, writtenAt = takenAt): string {
  const file = folder.pathFor(takenAt);
  writeFileSync(file, "jpg");
  utimesSync(file, writtenAt, writtenAt);
  return file;
}

function oldFile(path: string): string {
  writeFileSync(path, "keep");
  utimesSync(path, TWO_HOURS_AGO, TWO_HOURS_AGO);
  return path;
}

test("screenshot folder: a snapshot is named after the time it was taken", () => {
  const dir = emptyDir();
  const file = new ScreenshotFolder(dir).pathFor(new Date("2026-10-14T09:12:30.123Z"));
  assert.equal(file, join(dir, "2026-10-14T09-12-30-123Z.jpg"));
});

test("screenshot folder: remove deletes one of its snapshots", () => {
  const folder = new ScreenshotFolder(emptyDir());
  const file = shotIn(folder, new Date());
  folder.remove(file);
  assert.equal(existsSync(file), false);
});

test("screenshot folder: remove leaves a file it did not name", () => {
  const dir = emptyDir();
  const other = join(dir, "notes.jpg");
  writeFileSync(other, "keep");
  new ScreenshotFolder(dir).remove(other);
  assert.equal(existsSync(other), true);
});

test("screenshot folder: remove leaves a snapshot-named file outside its folder", () => {
  const outside = new ScreenshotFolder(emptyDir());
  const file = shotIn(outside, new Date());
  new ScreenshotFolder(emptyDir()).remove(file);
  assert.equal(existsSync(file), true);
});

test("screenshot folder: remove reaches nothing through ..", () => {
  const parent = emptyDir();
  const folder = new ScreenshotFolder(join(parent, "screenshots"));
  const file = shotIn(new ScreenshotFolder(parent), new Date());
  folder.remove(join(parent, "screenshots", "..", file.split("/").at(-1) ?? ""));
  assert.equal(existsSync(file), true);
});

test("screenshot folder: removeOlderThan deletes old snapshots", () => {
  const folder = new ScreenshotFolder(emptyDir());
  const old = shotIn(folder, TWO_HOURS_AGO);
  folder.removeOlderThan(Date.now() - HOUR_MS);
  assert.equal(existsSync(old), false);
});

test("screenshot folder: removeOlderThan keeps recent snapshots", () => {
  const folder = new ScreenshotFolder(emptyDir());
  const recent = shotIn(folder, new Date());
  folder.removeOlderThan(Date.now() - HOUR_MS);
  assert.equal(existsSync(recent), true);
});

test("screenshot folder: removeOlderThan keeps old files it did not name", () => {
  const dir = emptyDir();
  const other = oldFile(join(dir, "keep.jpg"));
  new ScreenshotFolder(dir).removeOlderThan(Date.now() - HOUR_MS);
  assert.equal(existsSync(other), true);
});

test("screenshot folder: removeOlderThan leaves a subfolder named like a snapshot", () => {
  const dir = emptyDir();
  const folder = new ScreenshotFolder(dir);
  const sub = folder.pathFor(TWO_HOURS_AGO);
  mkdirSync(sub);
  utimesSync(sub, TWO_HOURS_AGO, TWO_HOURS_AGO);
  folder.removeOlderThan(Date.now() - HOUR_MS);
  assert.equal(existsSync(sub), true);
});

test("screenshot folder: removeOlderThan neither deletes a link named like a snapshot nor its target", () => {
  const target = oldFile(join(emptyDir(), "photo.jpg"));
  const folder = new ScreenshotFolder(emptyDir());
  symlinkSync(target, folder.pathFor(TWO_HOURS_AGO));
  folder.removeOlderThan(Date.now() + HOUR_MS);
  assert.deepEqual([existsSync(folder.pathFor(TWO_HOURS_AGO)), existsSync(target)], [true, true]);
});
