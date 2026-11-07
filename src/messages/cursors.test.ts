import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { EMPTY_CURSOR, MessageCursors } from "./cursors.js";

const CURSOR = { checkedAt: "2026-11-05T09:00:00.000Z", chats: { D1: "1762333200.000100" }, namedChatIds: {} };

function cursorFile(): string {
  return join(mkdtempSync(join(tmpdir(), "cursors-")), "messages", "cursors.json");
}

test("cursors: a source never read starts empty", () => {
  assert.deepEqual(new MessageCursors(cursorFile()).of("slack:acme"), EMPTY_CURSOR);
});

test("cursors: a saved cursor is read back after a restart", () => {
  const file = cursorFile();
  new MessageCursors(file).save("slack:acme", CURSOR);
  assert.deepEqual(new MessageCursors(file).of("slack:acme"), CURSOR);
});

test("cursors: saving one source keeps the others", () => {
  const cursors = new MessageCursors(cursorFile());
  cursors.save("slack:acme", CURSOR);
  cursors.save("telegram", EMPTY_CURSOR);
  assert.deepEqual(cursors.of("slack:acme"), CURSOR);
});

test("cursors: the file holds only the cursor fields", () => {
  const file = cursorFile();
  new MessageCursors(file).save("slack:acme", CURSOR);
  assert.deepEqual(JSON.parse(readFileSync(file, "utf8")), { "slack:acme": CURSOR });
});

function damagedFile(): string {
  const file = join(mkdtempSync(join(tmpdir(), "cursors-")), "cursors.json");
  writeFileSync(file, JSON.stringify({ telegram: { checkedAt: "yesterday" } }));
  return file;
}

test("cursors: a damaged file doesn't stop the app from starting", () => {
  assert.doesNotThrow(() => new MessageCursors(damagedFile()));
});

test("cursors: reading a damaged file says how to fix it", () => {
  assert.throws(() => new MessageCursors(damagedFile()).of("telegram"), /is damaged .*delete it to start over/);
});

test("cursors: a damaged file is never overwritten", () => {
  const file = damagedFile();
  assert.throws(() => new MessageCursors(file).save("telegram", CURSOR));
  assert.match(readFileSync(file, "utf8"), /yesterday/);
});

test("cursors: once the damaged file is deleted, reading starts over without a restart", () => {
  const file = damagedFile();
  const cursors = new MessageCursors(file);
  assert.throws(() => cursors.of("telegram"));
  rmSync(file);
  assert.deepEqual(cursors.of("telegram"), EMPTY_CURSOR);
});
