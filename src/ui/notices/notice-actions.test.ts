import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppEvent, TaskEndEvent } from "../../events/app-events.js";
import type { NavigationTarget } from "../page-target.js";
import { NoticeActions } from "./notice-actions.js";
import { NoticeInbox } from "./notice-inbox.js";

const KAGGLE_1 = { project: "kaggle", session: "s1", label: "kaggle", sessionNumber: 1, task: "Retrain the model." };
const TASK_DONE: TaskEndEvent = { kind: "task_done", ...KAGGLE_1, result: "ok", note: "ok" };

function actionsOnOneNotice() {
  const inbox = new NoticeInbox();
  inbox.add(TASK_DONE);
  const opened: NavigationTarget[] = [];
  const silenced: AppEvent[] = [];
  const explained: string[] = [];
  const popupActions = {
    openPage: async (target: NavigationTarget) => void opened.push(target),
    silence: (event: AppEvent) => void silenced.push(event),
  };
  const explainer = {
    explainInWriting: async (project: string, focus: string) => {
      explained.push(`${project}: ${focus}`);
      return "It retrains with more data.";
    },
  };
  const actions = new NoticeActions(inbox, popupActions, explainer);
  return { actions, inbox, opened, silenced, explained, id: inbox.views()[0].id };
}

test("notice actions: the first touch silences the task's announcement", () => {
  const { actions, silenced, id } = actionsOnOneNotice();
  actions.markSeen(id);
  assert.deepEqual(silenced, [TASK_DONE]);
});

test("notice actions: the first touch keeps the notice from closing by itself", () => {
  const { actions, inbox, id } = actionsOnOneNotice();
  actions.markSeen(id);
  assert.equal(inbox.views()[0].seen, true);
});

test("notice actions: closing a notice silences the task's announcement", () => {
  const { actions, silenced, id } = actionsOnOneNotice();
  actions.close(id);
  assert.deepEqual(silenced, [TASK_DONE]);
});

test("notice actions: closing a notice removes it", () => {
  const { actions, inbox, id } = actionsOnOneNotice();
  actions.close(id);
  assert.equal(inbox.isEmpty(), true);
});

test("notice actions: a notice that closed by itself leaves the announcement alone", () => {
  const { actions, silenced, id } = actionsOnOneNotice();
  actions.expire(id);
  assert.deepEqual(silenced, []);
});

test("notice actions: touching a notice that just closed is no error", () => {
  const { actions, id } = actionsOnOneNotice();
  actions.close(id);
  assert.equal(actions.markSeen(id), "That notice was closed.");
});

test("notice actions: Open assistant opens the assistant's reply to that session's task", async () => {
  const { actions, opened, id } = actionsOnOneNotice();
  await actions.open(id, "assistant");
  assert.deepEqual(opened, [{ view: "assistant", sessionId: "s1" }]);
});

test("notice actions: Open session opens the worker's session", async () => {
  const { actions, opened, id } = actionsOnOneNotice();
  await actions.open(id, "session");
  assert.deepEqual(opened, [{ view: "session", sessionId: "s1" }]);
});

test("notice actions: Review changes opens the project's changes", async () => {
  const { actions, opened, id } = actionsOnOneNotice();
  await actions.open(id, "review");
  assert.deepEqual(opened, [{ view: "review", project: "kaggle" }]);
});

test("notice actions: Open assistant closes the notice", async () => {
  const { actions, inbox, id } = actionsOnOneNotice();
  await actions.open(id, "assistant");
  assert.equal(inbox.isEmpty(), true);
});

test("notice actions: Open session closes the notice", async () => {
  const { actions, inbox, id } = actionsOnOneNotice();
  await actions.open(id, "session");
  assert.equal(inbox.isEmpty(), true);
});

test("notice actions: Review changes keeps the notice", async () => {
  const { actions, inbox, id } = actionsOnOneNotice();
  await actions.open(id, "review");
  assert.equal(inbox.isEmpty(), false);
});

test("notice actions: opening a view silences the task's announcement", async () => {
  const { actions, silenced, id } = actionsOnOneNotice();
  await actions.open(id, "session");
  assert.deepEqual(silenced, [TASK_DONE]);
});

test("notice actions: Explain more asks about the project's changes, focused on the task", async () => {
  const { actions, explained, id } = actionsOnOneNotice();
  await actions.explain(id);
  assert.deepEqual(explained, ["kaggle: Retrain the model."]);
});

test("notice actions: an explanation stays with the notice", async () => {
  const { actions, inbox, id } = actionsOnOneNotice();
  await actions.explain(id);
  assert.equal(inbox.views()[0].explanation, "It retrains with more data.");
});
