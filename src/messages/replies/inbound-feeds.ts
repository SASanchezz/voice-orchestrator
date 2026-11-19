import { errorMessage } from "../../shared/errors.js";
import type { InboundFeed } from "./inbound.js";
import type { ReplyHealth } from "./reply-health.js";

/** Every source that sends replies; one that can't start is logged and the rest go on. */
export class InboundFeeds {
  constructor(
    private feeds: InboundFeed[],
    private health: ReplyHealth,
  ) {}

  start(): void {
    for (const feed of this.feeds) void this.startOrLog(feed);
  }

  private async startOrLog(feed: InboundFeed): Promise<void> {
    try {
      await feed.start();
      this.health.feedStarted(feed.name);
    } catch (error) {
      console.warn(`[replies] ${feed.name}: new messages won't get drafts: ${errorMessage(error)}`);
      this.health.feedFailed(feed.name, errorMessage(error));
    }
  }
}
