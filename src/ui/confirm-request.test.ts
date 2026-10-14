import { test } from "node:test";
import assert from "node:assert/strict";
import { openConfirmRequest, requestedVerbs } from "./confirm-request.js";
import type { FeedEntryView } from "./protocol.js";

const AT = "2026-10-13T10:00:00.000Z";

function entry(id: number, kind: FeedEntryView["kind"], text: string): FeedEntryView {
  return { id, at: AT, kind, text };
}

const ASKS_TO_PUSH = entry(2, "orchestrator", 'This pushes main to origin. Say "confirm push" to go ahead.');

test("a quoted confirm phrase names its verb", () => {
  assert.deepEqual(requestedVerbs('Say "confirm push".'), ["push"]);
});

test("curly quotes count too", () => {
  assert.deepEqual(requestedVerbs("Say “confirm delete”."), ["delete"]);
});

test("several phrases give each verb once", () => {
  assert.deepEqual(requestedVerbs('Say "confirm update" or "confirm delete", "Confirm update".'), ["update", "delete"]);
});

test("an unquoted mention is not a request", () => {
  assert.deepEqual(requestedVerbs("I can confirm push worked."), []);
});

test("the placeholder <verb> is not a request", () => {
  assert.deepEqual(requestedVerbs('Say "confirm <verb>".'), []);
});

test("the latest request is open while you haven't answered", () => {
  const entries = [entry(1, "user", "push main"), ASKS_TO_PUSH, entry(3, "event", "asks: Bash")];
  assert.deepEqual(openConfirmRequest(entries), { entryId: 2, verbs: ["push"] });
});

test("your next words close the request", () => {
  assert.equal(openConfirmRequest([ASKS_TO_PUSH, entry(3, "user", "confirm push")]), undefined);
});

test("a newer request replaces an older one", () => {
  const asksToRemove = entry(3, "orchestrator", 'Say "confirm remove".');
  assert.equal(openConfirmRequest([ASKS_TO_PUSH, asksToRemove])?.entryId, 3);
});

test("a chat without requests has none open", () => {
  assert.equal(openConfirmRequest([entry(1, "orchestrator", "Done.")]), undefined);
});
