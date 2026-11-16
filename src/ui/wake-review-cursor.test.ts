import { test } from "node:test";
import assert from "node:assert/strict";
import { ReviewCursor } from "./wake-review-cursor.js";

const COUNT = 3;

test("review cursor: the wake word's recordings are on screen first", () => {
  assert.equal(new ReviewCursor().kind, "wake");
});

test("review cursor: showing a kind selects its first recording", () => {
  const cursor = new ReviewCursor();
  cursor.select(2, COUNT);
  cursor.showKind("other");
  assert.equal(cursor.selected, 0);
});

test("review cursor: the other kind of the wake word is other talk", () => {
  assert.equal(new ReviewCursor().otherKind(), "other");
});

test("review cursor: selecting past the end stops at the last recording", () => {
  const cursor = new ReviewCursor();
  cursor.select(9, COUNT);
  assert.equal(cursor.selected, 2);
});

test("review cursor: selecting before the start stops at the first recording", () => {
  const cursor = new ReviewCursor();
  cursor.select(-1, COUNT);
  assert.equal(cursor.selected, 0);
});

test("review cursor: on the last recording, it says so", () => {
  const cursor = new ReviewCursor();
  cursor.select(2, COUNT);
  assert.equal(cursor.isOnLast(COUNT), true);
});
