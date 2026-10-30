import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChangedFileView } from "./change-views.js";
import { changeTotals, isReviewed, reviewComment, withReview, withoutReview } from "./reviewed-files.js";

function file(fingerprint: string, additions = 0, deletions = 0): ChangedFileView {
  return { path: "a.ts", kind: "modified", additions, deletions, staged: false, fingerprint };
}

test("reviewed: a marked file is reviewed", () => {
  assert.equal(isReviewed(withReview({}, "shop", file("1")), "shop", file("1")), true);
});

test("reviewed: a file that changed again needs a new look", () => {
  assert.equal(isReviewed(withReview({}, "shop", file("1")), "shop", file("2")), false);
});

test("reviewed: the same path in another project isn't marked", () => {
  assert.equal(isReviewed(withReview({}, "shop", file("1")), "billing", file("1")), false);
});

test("reviewed: a mark can be taken back", () => {
  const marks = withoutReview(withReview({}, "shop", file("1")), "shop", file("1"));
  assert.equal(isReviewed(marks, "shop", file("1")), false);
});

test("change totals add up every file", () => {
  const files = [file("1", 2, 1), file("2", 3, 0)];
  assert.equal(changeTotals({ project: "shop", isRepository: true, files, moreFiles: 0 }), "+5 −1");
});

test("a comment on a line names the file and line", () => {
  assert.equal(reviewComment("a.ts", 12, "use the helper"), "Review comment on a.ts line 12: use the helper");
});

test("a comment on a whole file names only the file", () => {
  assert.equal(reviewComment("a.ts", undefined, "too long"), "Review comment on a.ts: too long");
});
