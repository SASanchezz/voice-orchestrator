import { test } from "node:test";
import assert from "node:assert/strict";
import { shortFolder } from "./folder-path.js";

test("folder path: a short one is kept whole", () => {
  assert.equal(shortFolder("~/Desktop/Work/my/kaggle"), "~/Desktop/Work/my/kaggle");
});

test("folder path: a long one keeps its last folders", () => {
  assert.equal(shortFolder("~/Desktop/Work/prewins/repos/prewins-ui", 28), "…/prewins/repos/prewins-ui");
});

test("folder path: one very long folder name is kept for the page to cut", () => {
  assert.equal(shortFolder("~/a/an-extremely-long-folder-name", 10), "…/an-extremely-long-folder-name");
});
