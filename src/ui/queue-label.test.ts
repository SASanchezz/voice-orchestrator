import { test } from "node:test";
import assert from "node:assert/strict";
import { queuedLabel } from "./queue-label.js";
import type { SessionView } from "./session-protocol.js";

function session(changes: Partial<SessionView>): SessionView {
  return { id: "s1", number: 1, status: "idle", queued: [], costUsd: 0, history: [], ...changes };
}

const ONE_QUEUED = [{ id: "q1", instruction: "add tests" }];

test("queued label: nothing queued says nothing", () => {
  assert.equal(queuedLabel(session({})), "");
});

test("queued label: counts what waits", () => {
  assert.equal(queuedLabel(session({ queued: ONE_QUEUED })), "1 queued");
});

test("queued label: a paused queue says so", () => {
  assert.equal(queuedLabel(session({ queued: ONE_QUEUED, queuePaused: true })), "1 queued, paused");
});
