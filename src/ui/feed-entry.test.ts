import { test } from "node:test";
import assert from "node:assert/strict";
import { feedEntryFor } from "./feed-entry.js";

test("feed entry: a full context is shown in red, linking to its session", () => {
  const entry = feedEntryFor({
    kind: "context_full",
    project: "webshop",
    session: "s1",
    label: "webshop session 2",
    sessionNumber: 2,
    percent: 82,
  });
  assert.deepEqual(entry, {
    kind: "event",
    about: "webshop session 2",
    text: "context is 82% full; hand it off to a new session to keep costs down",
    failed: true,
    session: { project: "webshop", id: "s1", number: 2 },
  });
});
