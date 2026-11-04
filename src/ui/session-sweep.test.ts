import { test } from "node:test";
import assert from "node:assert/strict";
import type { SessionStatus, SessionView } from "./protocol.js";
import {
  closeAllReport,
  closeAllWarning,
  planCloseAll,
  planCloseOthers,
  sessionList,
  sweepReport,
} from "./session-sweep.js";

function session(number: number, status: SessionStatus = "idle"): SessionView {
  return { id: `s${number}`, number, status, queued: [], costUsd: 0, history: [] };
}

function numbersOf(sessions: SessionView[]): number[] {
  return sessions.map((s) => s.number);
}

const mixed = [session(1, "done"), session(2, "running"), session(3), session(4, "waiting_permission")];

test("close others keeps the right-clicked session", () => {
  assert.deepEqual(numbersOf(planCloseOthers(mixed, "s3").closing), [1]);
});

test("close others skips sessions whose worker is running or waiting for permission", () => {
  assert.deepEqual(numbersOf(planCloseOthers(mixed, "s3").skipped), [2, 4]);
});

test("close others never skips the kept session, even when it is running", () => {
  assert.deepEqual(numbersOf(planCloseOthers(mixed, "s2").skipped), [4]);
});

test("close all closes every idle session", () => {
  assert.deepEqual(numbersOf(planCloseAll(mixed).closing), [1, 3]);
});

test("close all skips the running sessions", () => {
  assert.deepEqual(numbersOf(planCloseAll(mixed).skipped), [2, 4]);
});

test("a list of one names a single session", () => {
  assert.equal(sessionList([session(2)]), "session 2");
});

test("a list of several joins the last with and", () => {
  assert.equal(sessionList([session(1), session(2), session(4)]), "sessions 1, 2 and 4");
});

test("the report lists what was closed and what was skipped", () => {
  assert.equal(
    sweepReport("webshop", planCloseOthers(mixed, "s3")),
    "Closed webshop session 1. Skipped sessions 2 and 4: their workers are running, so they stay open.",
  );
});

test("the report says when nothing could be closed", () => {
  const sweep = planCloseOthers([session(1), session(2, "running")], "s1");
  assert.equal(
    sweepReport("webshop", sweep),
    "Closed no webshop sessions. Skipped session 2: its worker is running, so it stays open.",
  );
});

test("closing all with nothing running says a new session took their place", () => {
  const sweep = planCloseAll([session(1), session(2)]);
  assert.equal(
    closeAllReport("webshop", sweep),
    "Closed webshop sessions 1 and 2. A new empty session is open in their place.",
  );
});

test("closing all with a running session doesn't promise a new one", () => {
  assert.doesNotMatch(closeAllReport("webshop", planCloseAll(mixed)), /new empty session/);
});

test("the close-all warning counts the sessions closed and running, and names the skipped ones", () => {
  assert.equal(
    closeAllWarning(planCloseAll(mixed)),
    "2 sessions will be closed: sessions 1 and 3. Their messages, queue and history are deleted. 2 running, skipped and kept open: sessions 2 and 4.",
  );
});

test("the close-all warning says when none are running", () => {
  assert.match(closeAllWarning(planCloseAll([session(1)])), /None are running; a new empty session opens/);
});
