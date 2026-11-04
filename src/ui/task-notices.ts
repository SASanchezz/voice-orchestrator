import type { AppEvent, AppEvents, TaskEndEvent } from "../events/app-events.js";
import { taskHeadline } from "../orchestrator/conversation/gist.js";
import { PAGE_VIEWS, type NavigationTarget } from "./page-target.js";
import type { PopupActions } from "./popup-actions.js";

/** One of a notice's buttons: what it says, the answer a click gives, and maybe a look of its own. */
export interface NoticeButton {
  answer: string;
  label: string;
  /** Without one, it's a plain system button. */
  look?: ButtonLook;
}

/** A button filled in its own colour, with an SF Symbol before its label, so it's told apart at a glance. */
export interface ButtonLook {
  color: ButtonColor;
  symbol: string;
}

export type ButtonColor = "gray" | "blue" | "purple" | "green";

/** A short native notice with buttons, left to right. */
export interface Notice {
  title: string;
  buttons: NoticeButton[];
}

/** Shows native notices; `chosen` gets the answer of the button clicked. */
export interface NoticeDevice {
  notify(notice: Notice, chosen: (answer: string) => void): void;
}

const REVIEW_ANSWER = "review";

/** Close only dismisses; the others' answers are the web UI views they open. Each one silences the task's voice, as the talk key does. */
const TASK_BUTTONS: NoticeButton[] = [
  { answer: "close", label: "Close", look: { color: "gray", symbol: "xmark" } },
  { answer: "assistant", label: "Open assistant", look: { color: "blue", symbol: "bubble.left.fill" } },
  { answer: "session", label: "Open session", look: { color: "purple", symbol: "terminal.fill" } },
  { answer: REVIEW_ANSWER, label: "Review changes", look: { color: "green", symbol: "doc.text.magnifyingglass" } },
];

/**
 * One native notice per ended task, so you see it from any app: "kaggle session 1 done: …".
 * It opens the assistant's reply to the task, the worker's session, or the project's changes in Review, in the web UI.
 * Once you've seen it and clicked, the task isn't also said aloud: what's playing stops, and the rest is dropped.
 */
export class TaskNotices {
  constructor(
    private device: NoticeDevice,
    private actions: PopupActions,
  ) {}

  follow(events: AppEvents): void {
    events.on("event", (e: AppEvent) => {
      if (e.kind === "task_done" || e.kind === "task_failed") this.show(e);
    });
  }

  private show(e: TaskEndEvent): void {
    this.device.notify({ title: taskHeadline(e), buttons: TASK_BUTTONS }, (answer) => {
      this.actions.silence(e);
      const target = targetOfAnswer(answer, e);
      if (target) void this.actions.openPage(target);
    });
  }
}

/** Where a notice's button takes the web UI; Close takes it nowhere. */
function targetOfAnswer(answer: string, e: TaskEndEvent): NavigationTarget | undefined {
  if (answer === REVIEW_ANSWER) return { view: "review", project: e.project };
  const view = PAGE_VIEWS.find((known) => known === answer);
  return view ? { view, sessionId: e.session } : undefined;
}
