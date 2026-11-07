import { test } from "node:test";
import assert from "node:assert/strict";
import type { TaskEndEvent } from "../../events/app-events.js";
import { NoticeInbox } from "./notice-inbox.js";

const LONG_NOTE = `${"I reworked the sign-up form. ".repeat(20)}\n\nAdded a resend countdown.`;

function doneIn(session: string, note = "All green."): TaskEndEvent {
  const subject = { project: "kaggle", session, label: "kaggle", sessionNumber: 1, task: "Please retrain the model." };
  return { kind: "task_done", ...subject, result: note, note };
}

function inboxWith(...events: TaskEndEvent[]): NoticeInbox {
  const inbox = new NoticeInbox();
  events.forEach((e) => inbox.add(e));
  return inbox;
}

test("notice inbox: an ended task waits with its headline", () => {
  assert.deepEqual(
    inboxWith(doneIn("s1"))
      .views()
      .map((n) => n.headline),
    ["kaggle session 1 done: retrain the model"],
  );
});

test("notice inbox: a session's newer ending takes the place of its older one", () => {
  const inbox = inboxWith(doneIn("s1", "first"), doneIn("s2"), doneIn("s1", "second"));
  assert.deepEqual(
    inbox.views().map((n) => n.summary),
    ["All green.", "second"],
  );
});

test("notice inbox: only the latest ten wait", () => {
  const events = Array.from({ length: 12 }, (_, i) => doneIn(`s${i}`));
  assert.equal(inboxWith(...events).views().length, 10);
});

test("notice inbox: a long note shows its last paragraph as the summary", () => {
  assert.equal(inboxWith(doneIn("s1", LONG_NOTE)).views()[0].summary, "Added a resend countdown.");
});

test("notice inbox: a long note is there whole", () => {
  assert.equal(inboxWith(doneIn("s1", LONG_NOTE)).views()[0].fullNote, LONG_NOTE);
});

test("notice inbox: a short note has nothing more to show", () => {
  assert.equal(inboxWith(doneIn("s1")).views()[0].fullNote, "");
});

test("notice inbox: a failed task shows its error", () => {
  const subject = { project: "kaggle", session: "s1", label: "kaggle", sessionNumber: 1, task: "Retrain" };
  const inbox = inboxWith({ kind: "task_failed", ...subject, error: "out of memory" });
  assert.deepEqual([inbox.views()[0].outcome, inbox.views()[0].summary], ["failed", "out of memory"]);
});

test("notice inbox: a closed notice is gone", () => {
  const inbox = inboxWith(doneIn("s1"));
  inbox.dismiss(inbox.views()[0].id);
  assert.equal(inbox.isEmpty(), true);
});

test("notice inbox: closing a notice twice does nothing the second time", () => {
  const inbox = inboxWith(doneIn("s1"));
  const { id } = inbox.views()[0];
  inbox.dismiss(id);
  assert.doesNotThrow(() => inbox.dismiss(id));
});

test("notice inbox: a seen notice says so", () => {
  const inbox = inboxWith(doneIn("s1"));
  inbox.markSeen(inbox.views()[0].id);
  assert.equal(inbox.views()[0].seen, true);
});

test("notice inbox: an explanation stays with its notice", () => {
  const inbox = inboxWith(doneIn("s1"));
  inbox.explained(inbox.views()[0].id, "It adds a timer.");
  assert.equal(inbox.views()[0].explanation, "It adds a timer.");
});

test("notice inbox: a closed notice's event is refused", () => {
  assert.throws(() => new NoticeInbox().eventOf("n9"), /That notice was closed/);
});

test("notice inbox: every change is announced", () => {
  const inbox = new NoticeInbox();
  let changes = 0;
  inbox.on("changed", () => changes++);
  inbox.add(doneIn("s1"));
  assert.equal(changes, 1);
});
