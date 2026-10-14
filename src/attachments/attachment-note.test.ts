import { test } from "node:test";
import assert from "node:assert/strict";
import { withAttachmentNote } from "./attachment-note.js";

const saved = [{ name: "a.png", path: "/state/attachments/1-ab/a.png", size: 2_621_440 }];

test("attachment note: files are listed after the text with their sizes", () => {
  assert.equal(withAttachmentNote("look", saved), "look\n\nAttached files:\n- /state/attachments/1-ab/a.png (2.5 MB)");
});

test("attachment note: a message without files is unchanged", () => {
  assert.equal(withAttachmentNote("look", []), "look");
});
