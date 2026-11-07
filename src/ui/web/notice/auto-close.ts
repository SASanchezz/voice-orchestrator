import type { NoticeView } from "../../notice-protocol.js";

/** As long as the old pop-up stayed: long enough to notice from across the room. */
const QUIET_MS = 30_000;

/**
 * Notices nobody touched close by themselves once things are quiet for a while after the latest one came; ones you
 * clicked or typed in stay until you close them. While you hover or type, the wait starts over.
 */
export class AutoClose {
  private timer?: number;
  private newestId?: string;

  constructor(
    private isBusy: () => boolean,
    private closeUntouched: () => void,
  ) {}

  follow(notices: NoticeView[]): void {
    const newest = notices.at(-1)?.id;
    if (newest === undefined || newest === this.newestId) return;
    this.newestId = newest;
    this.restart();
  }

  private restart(): void {
    window.clearTimeout(this.timer);
    this.timer = window.setTimeout(() => this.expire(), QUIET_MS);
  }

  private expire(): void {
    if (this.isBusy()) return this.restart();
    this.closeUntouched();
  }
}
