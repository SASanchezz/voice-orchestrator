import { test } from "node:test";
import assert from "node:assert/strict";
import type { NoticeView } from "./notice-protocol.js";
import { NoticeSelection } from "./notice-selection.js";

function notice(id: string, sessionId: string): NoticeView {
  const about = { project: "kaggle", sessionNumber: 1, outcome: "done", headline: "", task: "", summary: "" } as const;
  return { id, sessionId, ...about, fullNote: "", seen: false, endedAt: "2026-11-05T10:00:00Z" };
}

const FIRST = notice("n1", "s1");
const SECOND = notice("n2", "s2");

function selectionAfter(...steps: [NoticeView[], boolean][]): NoticeSelection {
  const selection = new NoticeSelection();
  steps.forEach(([notices, isBusy]) => selection.follow(notices, isBusy));
  return selection;
}

test("notice selection: the newest notice is shown", () => {
  assert.equal(selectionAfter([[FIRST, SECOND], false]).shown([FIRST, SECOND]), SECOND);
});

test("notice selection: a new notice waits while you are busy with the one on show", () => {
  const selection = selectionAfter([[FIRST], false], [[FIRST, SECOND], true]);
  assert.equal(selection.shown([FIRST, SECOND]), FIRST);
});

test("notice selection: a session's newer ending stays on show in its place", () => {
  const newer = notice("n3", "s1");
  const selection = selectionAfter([[FIRST], false], [[SECOND, newer], true]);
  assert.equal(selection.shown([SECOND, newer]), newer);
});

test("notice selection: once the shown notice is closed, the newest one shows", () => {
  const selection = selectionAfter([[FIRST, SECOND], false], [[FIRST], true]);
  assert.equal(selection.shown([FIRST]), FIRST);
});

test("notice selection: stepping back shows the one before", () => {
  const selection = selectionAfter([[FIRST, SECOND], false]);
  selection.step([FIRST, SECOND], -1);
  assert.equal(selection.shown([FIRST, SECOND]), FIRST);
});

test("notice selection: stepping stays at the ends", () => {
  const selection = selectionAfter([[FIRST, SECOND], false]);
  selection.step([FIRST, SECOND], 1);
  assert.equal(selection.shown([FIRST, SECOND]), SECOND);
});

test("notice selection: the position counts from the oldest", () => {
  assert.equal(selectionAfter([[FIRST, SECOND], false]).positionIn([FIRST, SECOND]), "2 of 2");
});
