import { test } from "node:test";
import assert from "node:assert/strict";
import { pageHash, parsePageHash } from "./page-target.js";

test("page target: a session target survives the link's hash", () => {
  const target = { view: "session", sessionId: "f6db8376-2d35" } as const;
  assert.deepEqual(parsePageHash(pageHash(target)), target);
});

test("page target: the assistant view is written as such", () => {
  assert.equal(pageHash({ view: "assistant", sessionId: "s1" }), "#open=assistant:s1");
});

test("page target: an unknown view or another hash is no target", () => {
  assert.deepEqual(
    [parsePageHash("#open=settings:s1"), parsePageHash("#top"), parsePageHash("")],
    [undefined, undefined, undefined],
  );
});
