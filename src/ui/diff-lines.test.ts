import { test } from "node:test";
import assert from "node:assert/strict";
import { diffLines, withHiddenRanges } from "./diff-lines.js";

const PATCH = [
  "diff --git a/a.ts b/a.ts",
  "--- a/a.ts",
  "+++ b/a.ts",
  "@@ -10,3 +20,3 @@ function a()",
  " kept",
  "-old",
  "+new",
  " kept too",
  "\\ No newline at end of file",
  "",
].join("\n");

test("diff lines: git's file header is left out", () => {
  assert.equal(diffLines(PATCH)[0].kind, "hunk");
});

test("diff lines: added lines count from the hunk's new start", () => {
  assert.deepEqual(diffLines(PATCH)[3], { kind: "added", text: "new", newLine: 21 });
});

test("diff lines: removed lines have no new line number", () => {
  assert.deepEqual(diffLines(PATCH)[2], { kind: "removed", text: "old" });
});

test("diff lines: lines after a removal keep counting", () => {
  assert.equal(diffLines(PATCH)[4].newLine, 22);
});

test("diff lines: git's no-newline note isn't a line", () => {
  assert.equal(diffLines(PATCH).length, 5);
});

test("diff lines: a second hunk restarts the count", () => {
  const lines = diffLines(`${PATCH}@@ -40 +50 @@\n+later`);
  assert.equal(lines.at(-1)?.newLine, 50);
});

const FILE_PATCH = ["@@ -10,2 +10,2 @@", " kept", "+new", "@@ -30 +30 @@", " later"].join("\n");

test("hidden ranges: the lines before the first hunk come first", () => {
  assert.deepEqual(withHiddenRanges(diffLines(FILE_PATCH), 30)[0], { kind: "hidden", from: 1, to: 9 });
});

test("hidden ranges: the lines between hunks sit before the later hunk", () => {
  assert.deepEqual(withHiddenRanges(diffLines(FILE_PATCH), 30)[4], { kind: "hidden", from: 12, to: 29 });
});

test("hidden ranges: the file's tail comes last", () => {
  assert.deepEqual(withHiddenRanges(diffLines(FILE_PATCH), 40).at(-1), { kind: "hidden", from: 31, to: 40 });
});

test("hidden ranges: a diff reaching the file's end has no tail", () => {
  assert.equal(withHiddenRanges(diffLines(FILE_PATCH), 30).at(-1)?.kind, "context");
});

test("hidden ranges: a hunk starting at line 1 hides nothing before it", () => {
  const entries = withHiddenRanges(diffLines("@@ -1 +1 @@\n+new"), 1);
  assert.deepEqual(
    entries.map(({ kind }) => kind),
    ["hunk", "added"],
  );
});

test("hidden ranges: a removed line takes no place in the file", () => {
  const entries = withHiddenRanges(diffLines("@@ -1,2 +1 @@\n-old\n kept"), 1);
  assert.ok(entries.every(({ kind }) => kind !== "hidden"));
});

test("hidden ranges: a diff with no hunks, as of a binary file, shows nothing", () => {
  assert.deepEqual(withHiddenRanges(diffLines("Binary files differ"), 9), []);
});
