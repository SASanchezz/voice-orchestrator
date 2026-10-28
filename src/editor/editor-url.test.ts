import { test } from "node:test";
import assert from "node:assert/strict";
import { editorUrl, isEditorPath } from "./editor-url.js";

test("editor url: the folder is encoded as one query value", () => {
  const url = new URL(editorUrl("/Users/me/my shop & co", "abc"), "http://127.0.0.1");
  assert.equal(url.searchParams.get("folder"), "/Users/me/my shop & co");
});

test("editor url: the token goes in tkn, as the editor server expects it", () => {
  const url = new URL(editorUrl("/w", "f00d"), "http://127.0.0.1");
  assert.equal(url.searchParams.get("tkn"), "f00d");
});

test("editor url: it is under the editor's base path", () => {
  assert.match(editorUrl("/w", "t"), /^\/editor\/\?/);
});

test("editor path: only paths under /editor are the editor's", () => {
  assert.deepEqual(["/editor", "/editor/static/x.js", "/editors", "/"].map(isEditorPath), [true, true, false, false]);
});
