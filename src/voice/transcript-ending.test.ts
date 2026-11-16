import { test } from "node:test";
import assert from "node:assert/strict";
import { withoutEnding } from "./transcript-ending.js";

test("transcript ending: the wake word at the end is cut off", () => {
  assert.equal(withoutEnding("Run the tests in billing. Oracle.", "oracle"), "Run the tests in billing.");
});

test("transcript ending: a comma before it goes too", () => {
  assert.equal(withoutEnding("What is webshop doing, Oracle!", "oracle"), "What is webshop doing");
});

test("transcript ending: a phrase of several words is cut off across punctuation", () => {
  assert.equal(withoutEnding("Status of billing. Hey, Jarvis.", "hey jarvis"), "Status of billing.");
});

test("transcript ending: the word inside the message stays", () => {
  assert.equal(
    withoutEnding("Connect to Oracle and list the tables.", "oracle"),
    "Connect to Oracle and list the tables.",
  );
});

test("transcript ending: a word that only ends with it stays", () => {
  assert.equal(withoutEnding("Open the miracle", "racle"), "Open the miracle");
});

test("transcript ending: only the wake word leaves nothing", () => {
  assert.equal(withoutEnding("Oracle.", "oracle"), "");
});

test("transcript ending: an empty ending changes nothing", () => {
  assert.equal(withoutEnding("Run the tests.", " "), "Run the tests.");
});
