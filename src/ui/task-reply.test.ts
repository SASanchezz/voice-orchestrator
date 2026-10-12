import { test } from "node:test";
import assert from "node:assert/strict";
import type { FeedEntryView } from "./protocol.js";
import { latestTaskEnd, replyLineIds } from "./task-reply.js";

const AT = "2026-10-12T10:00:00.000Z";
const WICKED_1 = { project: "wicked-fe", id: "s1", number: 1 };
const PREWINS_2 = { project: "prewins", id: "s2", number: 2 };

const ended = (id: number, session = WICKED_1): FeedEntryView => ({
  id,
  at: AT,
  kind: "event",
  text: "finished its task",
  taskOutcome: "done",
  session,
});
const reply = (id: number, session?: FeedEntryView["session"]): FeedEntryView => ({
  id,
  at: AT,
  kind: "orchestrator",
  text: "reply",
  session,
});

test("task reply: every line relaying the task's session after it", () => {
  const task = ended(1);
  assert.deepEqual(replyLineIds([task, reply(2, WICKED_1), reply(3, WICKED_1)], task), [2, 3]);
});

test("task reply: lines about another session or none are skipped", () => {
  const task = ended(1);
  assert.deepEqual(replyLineIds([task, reply(2), reply(3, PREWINS_2), reply(4, WICKED_1)], task), [4]);
});

test("task reply: the session's next task's reply is not this one's", () => {
  const task = ended(1);
  assert.deepEqual(replyLineIds([task, reply(2, WICKED_1), ended(3), reply(4, WICKED_1)], task), [2]);
});

test("task reply: before the reply arrives, the task's own line", () => {
  const task = ended(5);
  assert.deepEqual(replyLineIds([reply(4, WICKED_1), task], task), [5]);
});

test("task reply: a session's latest ended task is the one a notice points to", () => {
  const entries = [ended(1), reply(2, WICKED_1), ended(3), ended(4, PREWINS_2)];
  assert.equal(latestTaskEnd(entries, WICKED_1.id)?.id, 3);
});

test("task reply: a session with no ended task in the chat has none", () => {
  assert.equal(latestTaskEnd([reply(1, WICKED_1)], WICKED_1.id), undefined);
});
