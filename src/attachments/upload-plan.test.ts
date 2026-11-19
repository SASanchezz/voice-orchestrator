import assert from "node:assert/strict";
import { test } from "node:test";
import { MAX_ATTACHMENT_BYTES } from "./attachment-limits.js";
import { filesSentByPath } from "./upload-plan.js";

const MIB = 1_048_576;

function sized(megabytes: number): { size: number } {
  return { size: megabytes * MIB };
}

test("upload plan: a file over the per-file limit goes by path", () => {
  const video = { size: MAX_ATTACHMENT_BYTES + 1 };
  assert.deepEqual([...filesSentByPath([sized(1), video])], [video]);
});

test("upload plan: a file that would push the total past its limit goes by path", () => {
  const last = sized(9);
  assert.deepEqual([...filesSentByPath([sized(9), sized(9), last])], [last]);
});

test("upload plan: files within the limits are all uploaded", () => {
  assert.equal(filesSentByPath([sized(1), sized(2)]).size, 0);
});
