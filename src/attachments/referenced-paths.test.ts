import assert from "node:assert/strict";
import { test } from "node:test";
import { nameOf, readReferenceNote, withReferenceNote, type ReferencedPath } from "./referenced-paths.js";

const FOLDER: ReferencedPath = { path: "/Users/alex/project/config", isFolder: true };
const FILE: ReferencedPath = { path: "/Users/alex/project/notes.md", isFolder: false };

test("referenced paths: the note follows the text after a blank line", () => {
  assert.equal(withReferenceNote("look", [FILE]), "look\n\nReferenced paths:\n- /Users/alex/project/notes.md");
});

test("referenced paths: a folder's line ends in a slash", () => {
  assert.equal(withReferenceNote("", [FOLDER]), "Referenced paths:\n- /Users/alex/project/config/");
});

test("referenced paths: no paths leave the text as it is", () => {
  assert.equal(withReferenceNote("look", []), "look");
});

test("referenced paths: reading the note back gives the text", () => {
  assert.equal(readReferenceNote(withReferenceNote("look", [FOLDER, FILE])).text, "look");
});

test("referenced paths: reading the note back gives the paths, folders told apart", () => {
  assert.deepEqual(readReferenceNote(withReferenceNote("look", [FOLDER, FILE])).paths, [FOLDER, FILE]);
});

test("referenced paths: a message that is only the note has no text", () => {
  assert.equal(readReferenceNote(withReferenceNote("", [FILE])).text, "");
});

test("referenced paths: a message without a note comes back whole", () => {
  assert.deepEqual(readReferenceNote("just words"), { text: "just words", paths: [] });
});

test("referenced paths: a note with a line that isn't a path is left as text", () => {
  const message = "look\n\nReferenced paths:\n- /a\nsomething else";
  assert.deepEqual(readReferenceNote(message), { text: message, paths: [] });
});

test("referenced paths: a folder's name is its last part", () => {
  assert.equal(nameOf("/Users/alex/project/config/"), "config");
});

test("referenced paths: a file's name is its last part", () => {
  assert.equal(nameOf(FILE.path), "notes.md");
});
