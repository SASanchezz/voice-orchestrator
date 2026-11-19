import assert from "node:assert/strict";
import { test } from "node:test";
import { visibleText } from "./browsed-text.js";

test("browsed text: lines are kept", () => {
  assert.equal(visibleText("first\r\nsecond"), "first\nsecond");
});

test("browsed text: characters you can't see are taken out", () => {
  assert.equal(visibleText("ok\u202e\u200b go"), "ok go");
});

test("browsed text: secrets are hidden", () => {
  assert.equal(visibleText("token xoxb-1234567890-abcdef"), "token [hidden]");
});

test("browsed text: links are kept whole, unlike in summaries", () => {
  assert.equal(visibleText("see https://example.com/a?b=1"), "see https://example.com/a?b=1");
});
