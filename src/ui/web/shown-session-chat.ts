// One worker session's whole chat in a chat list: loaded from the server when shown, then grown by its live lines.

import type { PendingRequestView, SessionChatLine } from "../protocol.js";
import { fetchSessionMessages } from "./api.js";
import type { ChatList } from "./chat-list.js";
import { SessionFeed } from "./session-feed.js";

export class ShownSessionChat {
  /** undefined: no session's chat is shown */
  private shownSession?: string;
  private feed: SessionFeed;

  constructor(list: ChatList) {
    this.feed = new SessionFeed(list);
  }

  isShowing(): boolean {
    return this.shownSession !== undefined;
  }

  /** The list goes back to its other use; the next session shown loads afresh. */
  hide(): void {
    this.shownSession = undefined;
  }

  async show(sessionId: string): Promise<void> {
    if (this.shownSession === sessionId) return;
    this.shownSession = sessionId;
    this.feed.start(sessionId);
    const messages = await fetchSessionMessages(sessionId);
    if (this.shownSession !== sessionId) return; // switched again while loading
    messages.forEach((message) => this.feed.add(message));
    if (!messages.length) this.feed.showEmpty();
  }

  /** A session's chat was wiped on the server; its message ids start over. */
  clear(sessionId: string): void {
    if (sessionId === this.shownSession) this.feed.clear();
  }

  /** Marks which of the shown session's permission requests still wait for an answer. */
  showPendingApprovals(pending: PendingRequestView[]): void {
    if (this.shownSession) this.feed.showPendingApprovals(pending);
  }

  /** A live line from any session; shown only if that session is open. */
  add({ session, message }: SessionChatLine): void {
    if (session === this.shownSession) this.feed.add(message);
  }
}
