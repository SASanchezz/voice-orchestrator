import { test } from "node:test";
import assert from "node:assert/strict";
import { AppEvents, type AppEvent } from "../../events/app-events.js";
import { ShownSessions } from "./shown-sessions.js";
import { ShownTaskSilence } from "./shown-task-silence.js";

const KAGGLE_1 = { project: "kaggle", session: "s1", label: "kaggle", sessionNumber: 1, task: "Retrain the model." };
const TASK_DONE: AppEvent = { kind: "task_done", ...KAGGLE_1, result: "ok", note: "ok" };
const TASK_FAILED: AppEvent = { kind: "task_failed", ...KAGGLE_1, error: "out of memory" };
const QUESTION: AppEvent = { kind: "question", id: "q1", ...KAGGLE_1, questions: [] };

/** The events kept silent while a page shows `shown` and `events` arrive. */
function silencedWhileShowing(shown: string, ...events: AppEvent[]): AppEvent[] {
  const shownSessions = new ShownSessions();
  shownSessions.pageShows("page-1", shown);
  const silenced: AppEvent[] = [];
  const appEvents = new AppEvents();
  new ShownTaskSilence(shownSessions, { keepSilent: (e) => void silenced.push(e) }).follow(appEvents);
  events.forEach((e) => appEvents.emitEvent(e));
  return silenced;
}

test("shown task silence: a task done in the session on screen is not said", () => {
  assert.deepEqual(silencedWhileShowing("s1", TASK_DONE), [TASK_DONE]);
});

test("shown task silence: a task failed in the session on screen is not said", () => {
  assert.deepEqual(silencedWhileShowing("s1", TASK_FAILED), [TASK_FAILED]);
});

test("shown task silence: a task ending while another session is on screen is said", () => {
  assert.deepEqual(silencedWhileShowing("s2", TASK_DONE), []);
});

test("shown task silence: a worker's question in the session on screen is still said", () => {
  assert.deepEqual(silencedWhileShowing("s1", QUESTION), []);
});
