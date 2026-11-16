import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { WakeRecordings, type RecordingRef } from "./wake-recordings.js";

const WAKE_ONE: RecordingRef = { label: "wake", name: "1.wav" };
const OTHER_ONE: RecordingRef = { label: "other", name: "1.wav" };

/** A data/ folder holding the given files, each "<label>/<name>". */
function dataWith(...files: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "wake-recordings-"));
  for (const file of files) {
    mkdirSync(join(root, file, ".."), { recursive: true });
    writeFileSync(join(root, file), "RIFF");
  }
  return root;
}

function namesIn(recordings: WakeRecordings): string[] {
  return recordings.list().map(({ label, name }) => `${label}/${name}`);
}

test("wake recordings: listed oldest first, the wake word's before other talk", () => {
  const root = dataWith("other/1.wav", "wake/2.wav", "wake/1.wav");
  assert.deepEqual(namesIn(new WakeRecordings(root)), ["wake/1.wav", "wake/2.wav", "other/1.wav"]);
});

test("wake recordings: files that aren't recordings are left out", () => {
  const root = dataWith("wake/1.wav", "wake/notes.txt");
  assert.deepEqual(namesIn(new WakeRecordings(root)), ["wake/1.wav"]);
});

test("wake recordings: with nothing recorded yet, the list is empty", () => {
  assert.deepEqual(new WakeRecordings(dataWith()).list(), []);
});

test("wake recordings: deleting removes each file", () => {
  const root = dataWith("wake/1.wav", "other/1.wav");
  new WakeRecordings(root).deleteAll([WAKE_ONE, OTHER_ONE]);
  assert.deepEqual([existsSync(join(root, "wake/1.wav")), existsSync(join(root, "other/1.wav"))], [false, false]);
});

test("wake recordings: a recording that isn't there can't be deleted", () => {
  assert.throws(() => new WakeRecordings(dataWith()).deleteAll([WAKE_ONE]), /no recording wake\/1\.wav/);
});

test("wake recordings: with one of them missing, none is deleted", () => {
  const root = dataWith("wake/1.wav");
  assert.throws(() => new WakeRecordings(root).deleteAll([WAKE_ONE, OTHER_ONE]));
  assert.equal(existsSync(join(root, "wake/1.wav")), true);
});

test("wake recordings: a name reaching out of its folder is refused", () => {
  const root = dataWith("wake/1.wav", "secret.wav");
  assert.throws(() => new WakeRecordings(root).pathOf("wake", "../secret.wav"), /no recording/);
});
