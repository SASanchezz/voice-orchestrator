// Which notice the panel shows. No runtime imports, so the page bundles it and Node tests it.

import type { NoticeView } from "./notice-protocol.js";

/**
 * Which notice the panel shows, by session, so a session's newer ending simply takes its place. A new notice is shown
 * at once, unless you are busy with the one on show; then it only raises the count.
 */
export class NoticeSelection {
  private shownSession?: string;
  private newestId?: string;

  follow(notices: NoticeView[], isBusy: boolean): void {
    const newest = notices.at(-1);
    const arrived = newest !== undefined && newest.id !== this.newestId;
    this.newestId = newest?.id;
    const isGone = !notices.some((n) => n.sessionId === this.shownSession);
    const showsNewest = (arrived && !isBusy) || isGone;
    if (showsNewest) this.shownSession = newest?.sessionId;
  }

  /** One notice further back (-1) or forward (1), staying at the ends. */
  step(notices: NoticeView[], by: number): void {
    const index = this.indexIn(notices) + by;
    const target = notices.at(Math.min(Math.max(index, 0), notices.length - 1));
    if (target) this.shownSession = target.sessionId;
  }

  shown(notices: NoticeView[]): NoticeView | undefined {
    return notices.find((n) => n.sessionId === this.shownSession);
  }

  /** "2 of 4" */
  positionIn(notices: NoticeView[]): string {
    return `${this.indexIn(notices) + 1} of ${notices.length}`;
  }

  private indexIn(notices: NoticeView[]): number {
    return notices.findIndex((n) => n.sessionId === this.shownSession);
  }
}
