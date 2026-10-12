import { test } from "node:test";
import assert from "node:assert/strict";
import { AppEvents, type AppEvent } from "../events/app-events.js";
import { TestNotices } from "../testing/test-notices.js";
import type { PageTarget } from "./page-target.js";
import { TaskNotices } from "./task-notices.js";

const KAGGLE_1 = {
  project: "kaggle",
  session: "s1",
  label: "kaggle",
  sessionNumber: 1,
  task: "Please retrain the model.",
};
const TASK_DONE: AppEvent = { kind: "task_done", ...KAGGLE_1, result: "ok" };

function noticesFor(...events: AppEvent[]) {
  const appEvents = new AppEvents();
  const notices = new TestNotices();
  const opened: PageTarget[] = [];
  new TaskNotices(notices, async (target) => void opened.push(target)).follow(appEvents);
  events.forEach((e) => appEvents.emitEvent(e));
  return { notices, opened };
}

test("task notices: a finished task says so, with the session and the gist", () => {
  const { notices } = noticesFor(TASK_DONE);
  assert.deepEqual(
    notices.shown.map((n) => n.title),
    ["kaggle session 1 done: retrain the model"],
  );
});

test("task notices: a failed task says it failed", () => {
  const { notices } = noticesFor({ kind: "task_failed", ...KAGGLE_1, error: "out of memory" });
  assert.equal(notices.shown[0].title, "kaggle session 1 failed: retrain the model");
});

test("task notices: one ended task, one notice", () => {
  assert.equal(noticesFor(TASK_DONE).notices.shown.length, 1);
});

test("task notices: Close, Open assistant and Open session, left to right", () => {
  const { notices } = noticesFor(TASK_DONE);
  assert.deepEqual(
    notices.shown[0].buttons.map((b) => b.label),
    ["Close", "Open assistant", "Open session"],
  );
});

test("task notices: Open assistant opens the assistant's reply to that session's task", () => {
  const { notices, opened } = noticesFor(TASK_DONE);
  notices.shown[0].click("assistant");
  assert.deepEqual(opened, [{ view: "assistant", sessionId: "s1" }]);
});

test("task notices: Open session opens the worker's session", () => {
  const { notices, opened } = noticesFor(TASK_DONE);
  notices.shown[0].click("session");
  assert.deepEqual(opened, [{ view: "session", sessionId: "s1" }]);
});

test("task notices: Close opens nothing", () => {
  const { notices, opened } = noticesFor(TASK_DONE);
  notices.shown[0].click("close");
  assert.deepEqual(opened, []);
});

test("task notices: a permission request is not a task notice", () => {
  const { notices } = noticesFor({ kind: "permission", id: "p1", ...KAGGLE_1, description: "Bash: ls" });
  assert.equal(notices.shown.length, 0);
});
