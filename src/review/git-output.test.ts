import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNumstat, parseStatus, patchAddingFile } from "./git-output.js";

test("status: a modified file that isn't staged", () => {
  assert.deepEqual(parseStatus(" M src/a.ts\0"), [{ path: "src/a.ts", kind: "modified", staged: false }]);
});

test("status: a fully staged file", () => {
  assert.deepEqual(parseStatus("M  src/a.ts\0"), [{ path: "src/a.ts", kind: "modified", staged: true }]);
});

test("status: a file changed again after staging isn't fully staged", () => {
  assert.equal(parseStatus("MM src/a.ts\0")[0].staged, false);
});

test("status: an untracked file counts as added", () => {
  assert.deepEqual(parseStatus("?? new file.ts\0"), [{ path: "new file.ts", kind: "added", staged: false }]);
});

test("status: a deleted file", () => {
  assert.equal(parseStatus(" D old.ts\0")[0].kind, "deleted");
});

test("status: no changes give no entries", () => {
  assert.deepEqual(parseStatus(""), []);
});

test("status: output that isn't git's is refused", () => {
  assert.throws(() => parseStatus("nonsense\0"));
});

test("numstat: line counts by path", () => {
  assert.deepEqual(parseNumstat("12\t3\tsrc/a.ts\0").get("src/a.ts"), { additions: 12, deletions: 3 });
});

test("numstat: a binary file counts no lines", () => {
  assert.deepEqual(parseNumstat("-\t-\tlogo.png\0").get("logo.png"), { additions: 0, deletions: 0 });
});

test("a new file's patch adds each of its lines", () => {
  assert.equal(patchAddingFile("one\ntwo\n"), "@@ -0,0 +1,2 @@\n+one\n+two");
});
