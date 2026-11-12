import { test } from "node:test";
import assert from "node:assert/strict";
import { openConfirmRequest, openGoAheadLineId } from "./confirm-request.js";
import type { FeedEntryView } from "./protocol.js";

const AT = "2026-10-13T10:00:00.000Z";

function entry(id: number, kind: FeedEntryView["kind"], text: string): FeedEntryView {
  return { id, at: AT, kind, text };
}

const ASKS_TO_PUSH = entry(2, "orchestrator", 'This pushes main to origin. Say "confirm push" to go ahead.');
const MENTIONS_COMMIT = entry(
  2,
  "orchestrator",
  'Removing it needs a commit, which needs your "confirm commit" first.',
);

test("the asked verbs go under the assistant's latest line", () => {
  const entries = [entry(1, "user", "push main"), ASKS_TO_PUSH, entry(3, "event", "asks: Bash")];
  assert.deepEqual(openConfirmRequest(entries, ["push"]), { entryId: 2, verbs: ["push"] });
});

test("a quoted phrase the server didn't ask for shows no buttons", () => {
  assert.equal(openConfirmRequest([MENTIONS_COMMIT], []), undefined);
});

test("your next words close the request", () => {
  assert.equal(openConfirmRequest([ASKS_TO_PUSH, entry(3, "user", "confirm push")], ["push"]), undefined);
});

test("a later reply takes the buttons", () => {
  const followUp = entry(3, "orchestrator", "It pushes three commits.");
  assert.equal(openConfirmRequest([ASKS_TO_PUSH, followUp], ["push"])?.entryId, 3);
});

test("a chat without assistant lines has nowhere to put them", () => {
  assert.equal(openConfirmRequest([entry(1, "user", "hello")], ["push"]), undefined);
});

const ASKS_TO_START = entry(2, "orchestrator", "Shall I start the refactor?");

test("the go-ahead buttons go under the assistant's latest line", () => {
  const entries = [entry(1, "user", "refactor the parser"), ASKS_TO_START, entry(3, "event", "asks: Bash")];
  assert.equal(openGoAheadLineId(entries, true), 2);
});

test("a go-ahead the server didn't ask for shows no buttons", () => {
  assert.equal(openGoAheadLineId([ASKS_TO_START], false), undefined);
});

test("your next words close the go-ahead question", () => {
  assert.equal(openGoAheadLineId([ASKS_TO_START, entry(3, "user", "yes")], true), undefined);
});
