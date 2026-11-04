import { test } from "node:test";
import assert from "node:assert/strict";
import { diffLines, withHiddenRanges } from "./diff-lines.js";
import { splitEntries } from "./split-diff.js";

const PATCH = [
  "@@ -20,4 +20,3 @@ function a()",
  " kept",
  "-old one",
  "-old two",
  "+new one",
  " kept too",
  "@@ -41,1 +40,2 @@",
  " last",
  "+appended",
  "",
].join("\n");

const LINE_COUNT = 50;

const entries = splitEntries(diffLines(PATCH));
const entriesWithHidden = splitEntries(withHiddenRanges(diffLines(PATCH), LINE_COUNT));

test("split diff: hunk headers pass through", () => {
  assert.deepEqual(entries[0], { kind: "hunk", text: "@@ -20,4 +20,3 @@ function a()" });
});

test("split diff: an unchanged line shows on both sides, each with its own number", () => {
  assert.deepEqual(entries[1], {
    kind: "split",
    old: { kind: "context", text: "kept", number: 20 },
    new: { kind: "context", text: "kept", number: 20 },
  });
});

test("split diff: a removed line sits beside the added line that replaced it", () => {
  assert.deepEqual(entries[2], {
    kind: "split",
    old: { kind: "removed", text: "old one", number: 21 },
    new: { kind: "added", text: "new one", number: 21 },
  });
});

test("split diff: a removed line with nothing to replace it leaves the new side empty", () => {
  assert.deepEqual(entries[3], {
    kind: "split",
    old: { kind: "removed", text: "old two", number: 22 },
    new: undefined,
  });
});

test("split diff: lines after a change keep counting on both sides", () => {
  assert.deepEqual(entries[4], {
    kind: "split",
    old: { kind: "context", text: "kept too", number: 23 },
    new: { kind: "context", text: "kept too", number: 22 },
  });
});

test("split diff: a later hunk's old lines count from its old start", () => {
  assert.deepEqual(entries[6], {
    kind: "split",
    old: { kind: "context", text: "last", number: 41 },
    new: { kind: "context", text: "last", number: 40 },
  });
});

test("split diff: an added line with nothing it replaced leaves the old side empty", () => {
  assert.deepEqual(entries[7], { kind: "split", old: undefined, new: { kind: "added", text: "appended", number: 41 } });
});

test("split diff: a hidden range before the first change starts at the same line in both files", () => {
  assert.deepEqual(entriesWithHidden[0], { kind: "hidden", from: 1, to: 19, oldFrom: 1 });
});

test("split diff: a hidden range keeps the offset the change before it left", () => {
  assert.deepEqual(entriesWithHidden[6], { kind: "hidden", from: 23, to: 39, oldFrom: 24 });
});
