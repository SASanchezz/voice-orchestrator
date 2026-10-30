import { test } from "node:test";
import assert from "node:assert/strict";
import { diffLines } from "./diff-lines.js";

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
