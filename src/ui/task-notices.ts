import type { AppEvent, AppEvents, TaskEndEvent } from "../events/app-events.js";
import { taskHeadline } from "../orchestrator/conversation/gist.js";
import { PAGE_VIEWS, type PageTarget } from "./page-target.js";

/** One of a notice's buttons: what it says, and the answer a click gives. */
export interface NoticeButton {
  answer: string;
  label: string;
}

/** A short native notice with buttons, left to right. */
export interface Notice {
  title: string;
  buttons: NoticeButton[];
}

/** Shows native notices; `chosen` gets the answer of the button clicked. */
export interface NoticeDevice {
  notify(notice: Notice, chosen: (answer: string) => void): void;
}

/** Close only dismisses; the others' answers are the web UI views they open. */
const TASK_BUTTONS: NoticeButton[] = [
  { answer: "close", label: "Close" },
  { answer: "assistant", label: "Open assistant" },
  { answer: "session", label: "Open session" },
];

/**
 * One native notice per ended task, so you see it from any app: "kaggle session 1 done: …".
 * It opens the assistant's reply to the task, or the worker's session, in the web UI.
 */
export class TaskNotices {
  constructor(
    private device: NoticeDevice,
    private openPage: (target: PageTarget) => Promise<void>,
  ) {}

  follow(events: AppEvents): void {
    events.on("event", (e: AppEvent) => {
      if (e.kind === "task_done" || e.kind === "task_failed") this.show(e);
    });
  }

  private show(e: TaskEndEvent): void {
    this.device.notify({ title: taskHeadline(e), buttons: TASK_BUTTONS }, (answer) => {
      const view = PAGE_VIEWS.find((known) => known === answer);
      if (view) void this.openPage({ view, sessionId: e.session });
    });
  }
}
