import { test } from "node:test";
import assert from "node:assert/strict";
import { AppEvents, type AppEvent } from "../../events/app-events.js";
import { TestNoticePanel } from "../../testing/test-notices.js";
import { AfterTalking } from "../../voice/after-talking.js";
import { LinkedNoticePanel } from "./linked-notice-panel.js";
import { NoticeInbox } from "./notice-inbox.js";
import { ShownSessions } from "./shown-sessions.js";
import { TaskNotices } from "./task-notices.js";

const NOTICE_LINK = "http://127.0.0.1:1/notice?token=t";
const KAGGLE_1 = { project: "kaggle", session: "s1", label: "kaggle", sessionNumber: 1, task: "Retrain the model." };
const TASK_DONE: AppEvent = { kind: "task_done", ...KAGGLE_1, result: "ok", note: "ok" };

const NO_SHOWN_SESSIONS = new ShownSessions();
const QUIET = { isListening: () => false };

function noticesFor(...events: AppEvent[]) {
  return noticesWhileShown(NO_SHOWN_SESSIONS, ...events);
}

function noticesWhileShown(shownSessions: ShownSessions, ...events: AppEvent[]) {
  return noticesHeard(shownSessions, QUIET, events);
}

/** You talk until `talking.stopped` is set. */
function noticesWhileTalking(...events: AppEvent[]) {
  const talking = { stopped: false, isListening: () => !talking.stopped };
  return { talking, ...noticesHeard(NO_SHOWN_SESSIONS, talking, events) };
}

function noticesHeard(shownSessions: ShownSessions, voice: { isListening(): boolean }, events: AppEvent[]) {
  const appEvents = new AppEvents();
  const panel = new TestNoticePanel();
  const inbox = new NoticeInbox();
  const notices = new TaskNotices(new LinkedNoticePanel(panel, () => NOTICE_LINK), inbox, shownSessions);
  notices.follow(appEvents, new AfterTalking(voice));
  events.forEach((e) => appEvents.emitEvent(e));
  return { panel, inbox };
}

function shownOnPage(session: string): ShownSessions {
  const shownSessions = new ShownSessions();
  shownSessions.pageShows("page-1", session);
  return shownSessions;
}

test("task notices: an ended task brings up the panel with the notice page", () => {
  assert.deepEqual(noticesFor(TASK_DONE).panel.shownLinks, [NOTICE_LINK]);
});

test("task notices: an ended task waits in the inbox", () => {
  assert.equal(noticesFor(TASK_DONE).inbox.views().length, 1);
});

test("task notices: a failed task is a notice too", () => {
  const { inbox } = noticesFor({ kind: "task_failed", ...KAGGLE_1, error: "out of memory" });
  assert.equal(inbox.views()[0].outcome, "failed");
});

test("task notices: a permission request is not a task notice", () => {
  const { panel } = noticesFor({ kind: "permission", id: "p1", ...KAGGLE_1, description: "Bash: ls" });
  assert.deepEqual(panel.shownLinks, []);
});

test("task notices: closing the last notice hides the panel", () => {
  const { panel, inbox } = noticesFor(TASK_DONE);
  inbox.dismiss(inbox.views()[0].id);
  assert.equal(panel.isShowing, false);
});

test("task notices: the panel stays while a notice is left", () => {
  const { panel, inbox } = noticesFor(TASK_DONE, { ...TASK_DONE, session: "s2" });
  inbox.dismiss(inbox.views()[0].id);
  assert.equal(panel.isShowing, true);
});

test("task notices: a task ending in the session a page has on screen brings up no panel", () => {
  assert.deepEqual(noticesWhileShown(shownOnPage("s1"), TASK_DONE).panel.shownLinks, []);
});

test("task notices: a task ending in the session a page has on screen is not kept", () => {
  assert.equal(noticesWhileShown(shownOnPage("s1"), TASK_DONE).inbox.isEmpty(), true);
});

test("task notices: a task ending while a page shows another session brings up the panel", () => {
  assert.deepEqual(noticesWhileShown(shownOnPage("s2"), TASK_DONE).panel.shownLinks, [NOTICE_LINK]);
});

test("task notices: a task ending while you talk brings up no panel yet", () => {
  const { talking, panel } = noticesWhileTalking(TASK_DONE);
  const shownLinks = [...panel.shownLinks];
  talking.stopped = true;
  assert.deepEqual(shownLinks, []);
});

test("task notices: a task ending while you talk is not in the panel yet", () => {
  const { talking, inbox } = noticesWhileTalking(TASK_DONE);
  const isEmpty = inbox.isEmpty();
  talking.stopped = true;
  assert.equal(isEmpty, true);
});

test("task notices: a task that ended while you talked comes up once you stop", async () => {
  const { talking, inbox } = noticesWhileTalking(TASK_DONE);
  talking.stopped = true;
  await waitForPanel(inbox);
  assert.equal(inbox.views().length, 1);
});

function waitForPanel(inbox: NoticeInbox): Promise<void> {
  return new Promise((resolve) => inbox.once("changed", resolve));
}
