import { test } from "node:test";
import assert from "node:assert/strict";
import { endsWithStopPhrase, spokenRequest } from "./spoken-request.js";

test("spoken request: words ending with finish end the recording", () => {
  assert.equal(endsWithStopPhrase("Run the tests in billing. Finish."), true);
});

test("spoken request: words ending with finish recording end the recording", () => {
  assert.equal(endsWithStopPhrase("Run the tests, finish recording"), true);
});

test("spoken request: finish inside the words doesn't end the recording", () => {
  assert.equal(endsWithStopPhrase("Finish the report and send it"), false);
});

test("spoken request: finish is cut from the end", () => {
  assert.equal(spokenRequest("Run the tests in billing. Finish."), "Run the tests in billing.");
});

test("spoken request: finish recording is cut off whole", () => {
  assert.equal(spokenRequest("Run the tests, finish recording."), "Run the tests");
});

test("spoken request: only finish asks for nothing", () => {
  assert.equal(spokenRequest("Finish."), "");
});

test("spoken request: only filler asks for nothing", () => {
  assert.equal(spokenRequest("Um... uh."), "");
});

test("spoken request: a request without a stop phrase stays as it is", () => {
  assert.equal(spokenRequest("Connect to Oracle and list the tables."), "Connect to Oracle and list the tables.");
});
