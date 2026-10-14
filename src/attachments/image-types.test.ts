import { test } from "node:test";
import assert from "node:assert/strict";
import { imageTypeOf } from "./image-types.js";

test("image types: a picture's type comes from its extension, in any case", () => {
  assert.equal(imageTypeOf("/state/attachments/1-ab/Shot.JPG"), "image/jpeg");
});

test("image types: other files are not images", () => {
  assert.equal(imageTypeOf("notes.txt"), undefined);
});

test("image types: a file without an extension is not an image", () => {
  assert.equal(imageTypeOf("/state/attachments/1-ab/README"), undefined);
});
