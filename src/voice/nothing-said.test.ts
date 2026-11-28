import assert from "node:assert/strict";
import { test } from "node:test";
import { meansNothingSaid } from "./nothing-said.js";

test("whisper's silence marker means nothing was said", () => {
  assert.equal(meansNothingSaid("(BLANK_AUDIO)"), true);
});

test("thank you made up from silence, over and over, means nothing was said", () => {
  assert.equal(meansNothingSaid("Thank you. Thank you. Thank you."), true);
});

test("a mix of made-up phrases means nothing was said", () => {
  assert.equal(meansNothingSaid("Thank you very much. You. Thanks for watching!"), true);
});

test("thank you inside real words is kept", () => {
  assert.equal(meansNothingSaid("Run the tests, thank you."), false);
});

test("words that only start like a silence phrase are kept", () => {
  assert.equal(meansNothingSaid("Your turn"), false);
});
