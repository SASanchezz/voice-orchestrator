import type { AppEvent, AppEvents, TaskEndEvent } from "../../events/app-events.js";
import type { NoticeInbox } from "./notice-inbox.js";
import type { ShownSessions } from "./shown-sessions.js";

/** The native notice panel, which shows the web UI's notice page. */
export interface NoticePanelDevice {
  /** Opens `link` the first time, then brings the panel up without taking focus from the app you're in. */
  show(link: string): void;
  hide(): void;
}

/** The notice panel, already pointed at its page. */
export interface NoticePanel {
  show(): void;
  hide(): void;
}

/**
 * Each ended task waits in the notice panel, so you can read it from any app instead of listening, and reply to the
 * worker right there. A task that ends in the session a web UI page has on screen gets no notice. The panel goes away
 * once its last notice is closed.
 */
export class TaskNotices {
  constructor(
    private panel: NoticePanel,
    private inbox: NoticeInbox,
    private shownSessions: ShownSessions,
  ) {}

  follow(events: AppEvents): void {
    events.on("event", (e: AppEvent) => {
      if (e.kind === "task_done" || e.kind === "task_failed") this.noticeUnlessShown(e);
    });
    this.inbox.on("changed", () => {
      if (this.inbox.isEmpty()) this.panel.hide();
    });
  }

  private noticeUnlessShown(e: TaskEndEvent): void {
    if (this.shownSessions.isShown(e.session)) return;
    this.inbox.add(e);
    this.panel.show();
  }
}
