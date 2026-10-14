import { test } from "node:test";
import assert from "node:assert/strict";
import { withAttachmentNote } from "./attachment-note.js";
import { readAttachmentNote } from "./noted-files.js";

const SHOT = { name: "shot.png", path: "/state/attachments/1-ab/shot.png", size: 2_621_440 };
const LOG = { name: "app log.txt", path: "/state/attachments/2-cd/app log.txt", size: 300 };

test("noted files: the text comes back without the note", () => {
  assert.equal(readAttachmentNote(withAttachmentNote("look at this", [SHOT])).text, "look at this");
});

test("noted files: each listed file comes back with its path, name and size", () => {
  assert.deepEqual(readAttachmentNote(withAttachmentNote("look", [SHOT, LOG])).files, [
    { path: SHOT.path, name: "shot.png", size: "2.5 MB" },
    { path: LOG.path, name: "app log.txt", size: "1 KB" },
  ]);
});

test("noted files: a message of only files has no text", () => {
  assert.equal(readAttachmentNote(withAttachmentNote("", [SHOT])).text, "");
});

test("noted files: a message without a note comes back whole", () => {
  assert.deepEqual(readAttachmentNote("just words"), { text: "just words", files: [] });
});

test("noted files: a note with a line it didn't write is left as text", () => {
  const typed = "see\n\nAttached files:\n- /etc/hosts";
  assert.deepEqual(readAttachmentNote(typed), { text: typed, files: [] });
});
