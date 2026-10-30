import { test } from "node:test";
import assert from "node:assert/strict";
import { splitSentences } from "./sentences.js";

test("sentences: splits after a full stop, question mark or exclamation mark", () => {
  assert.deepEqual(splitSentences("Done. Tests pass! Push it?"), ["Done.", "Tests pass!", "Push it?"]);
});

test("sentences: keeps a dot inside a word or number in its sentence", () => {
  assert.deepEqual(splitSentences("Bumped to 2.4 in package.json. Done."), ["Bumped to 2.4 in package.json.", "Done."]);
});

test("sentences: text without an ending is one sentence", () => {
  assert.deepEqual(splitSentences("webshop session 2 done"), ["webshop session 2 done"]);
});
