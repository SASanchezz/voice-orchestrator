// What the notice panel's buttons and keyboard shortcuts do. A refusal from the server shows under the notice.

import type { NoticeTarget, NoticeView } from "../../notice-protocol.js";
import { post } from "../api.js";
import { byId } from "../dom.js";
import { store } from "../store.js";
import { box, content, hints, render, reply, selection, shownNotice } from "./notice-page.js";
import type { NoticeCommand } from "./notice-shortcuts.js";

const COMMANDS: Record<NoticeCommand, () => void> = {
  send: () => void reply.send(),
  mic: () => void box.toggle(),
  close: () => withShown(close),
  closeAll: () => store.state.notices.forEach(close),
  explain: () => withShown((notice) => void explain(notice)),
  fullNote: () => content.toggleFullNote(),
  openAssistant: () => openView("assistant"),
  openSession: () => openView("session"),
  review: () => openView("review"),
  previous: () => stepBy(-1),
  next: () => stepBy(1),
};

/** The ids already reported seen, so each is reported once. */
const reportedSeen = new Set<string>();

export function runCommand(command: NoticeCommand): void {
  hints.hide();
  showProblem("");
  COMMANDS[command]();
}

/** Your first click or keystroke on a notice: what is said about it stops, and it no longer closes by itself. */
export function markShownSeen(): void {
  withShown(({ id, seen }) => {
    if (seen || reportedSeen.has(id)) return;
    reportedSeen.add(id);
    void attempt(`/api/notices/${id}/seen`);
  });
}

/** The quiet wait is over: the notices nobody touched go, and what is said about them is left alone. */
export function closeUntouched(): void {
  store.state.notices.filter((notice) => !notice.seen).forEach(({ id }) => void attempt(`/api/notices/${id}/expire`));
}

function withShown(act: (notice: NoticeView) => void): void {
  const notice = shownNotice();
  if (notice) act(notice);
}

function close({ id }: NoticeView): void {
  void attempt(`/api/notices/${id}/close`);
}

function openView(view: NoticeTarget): void {
  withShown(({ id }) => void attempt(`/api/notices/${id}/open`, { view }));
}

/** It takes a while, written on the project's account; the button says so meanwhile. */
async function explain({ id }: NoticeView): Promise<void> {
  content.markExplaining(id, true);
  render();
  await attempt(`/api/notices/${id}/explain`);
  content.markExplaining(id, false);
  render();
}

function stepBy(by: number): void {
  selection.step(store.state.notices, by);
  render();
}

async function attempt(path: string, body: object = {}): Promise<void> {
  try {
    await post(path, body);
  } catch (error) {
    showProblem(error instanceof Error ? error.message : String(error));
  }
}

function showProblem(text: string): void {
  const problem = byId("notice-problem", HTMLElement);
  problem.textContent = text;
  problem.hidden = text === "";
}
