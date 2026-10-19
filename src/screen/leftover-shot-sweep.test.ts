import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LEFTOVER_SHOT_MAX_AGE_MS, sweepLeftoverShots } from "./leftover-shot-sweep.js";
import { ScreenshotFolder } from "./screenshot-folder.js";

function shotWrittenAgo(folder: ScreenshotFolder, ageMs: number): string {
  const writtenAt = new Date(Date.now() - ageMs);
  const file = folder.pathFor(writtenAt);
  writeFileSync(file, "jpg");
  utimesSync(file, writtenAt, writtenAt);
  return file;
}

test("leftover shot sweep: starting deletes snapshots older than the limit and keeps newer ones", () => {
  const folder = new ScreenshotFolder(mkdtempSync(join(tmpdir(), "vo-sweep-")));
  const leftover = shotWrittenAgo(folder, LEFTOVER_SHOT_MAX_AGE_MS + 60_000);
  const recent = shotWrittenAgo(folder, 60_000);
  sweepLeftoverShots(folder);
  assert.deepEqual([existsSync(leftover), existsSync(recent)], [false, true]);
});
