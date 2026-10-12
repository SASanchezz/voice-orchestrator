// The center chat: the orchestrator's conversation, or one worker session's own message history.

import type { FeedEntryView, SessionChatLine } from "../protocol.js";
import { fetchSessionMessages } from "./api.js";
import { emptySessionItem, feedItem, sessionItem } from "./chat-items.js";
import { ChatList } from "./chat-list.js";
import { latestTaskEnd, replyLineIds } from "../task-reply.js";

export class ChatView {
  private list = new ChatList();
  private orchestratorEntries: FeedEntryView[] = [];
  /** undefined: the orchestrator's chat is shown */
  private shownSession?: string;
  private lastMessageId = 0;

  /** The orchestrator's timeline as the server had it when the page connected. */
  setOrchestratorBacklog(entries: FeedEntryView[]): void {
    this.orchestratorEntries = entries;
    if (!this.shownSession) this.list.render(entries.map(feedItem));
  }

  addOrchestratorEntry(entry: FeedEntryView): void {
    this.orchestratorEntries.push(entry);
    if (!this.shownSession) this.list.append(feedItem(entry));
  }

  showOrchestrator(): void {
    if (!this.shownSession) return;
    this.shownSession = undefined;
    this.list.render(this.orchestratorEntries.map(feedItem));
  }

  /** Points out the assistant's reply to the session's latest ended task, in its chat, which must be the one shown. */
  revealTaskReply(sessionId: string): void {
    const ended = latestTaskEnd(this.orchestratorEntries, sessionId);
    if (ended) this.list.highlight(replyLineIds(this.orchestratorEntries, ended));
  }

  async showSession(sessionId: string): Promise<void> {
    if (this.shownSession === sessionId) return;
    this.shownSession = sessionId;
    this.lastMessageId = 0;
    this.list.render([]);
    const messages = await fetchSessionMessages(sessionId);
    if (this.shownSession !== sessionId) return; // switched again while loading
    messages.forEach((message) => this.addSessionMessage({ session: sessionId, message }));
    if (!messages.length) this.list.render([emptySessionItem()]);
  }

  /** A session's chat was wiped on the server; its message ids start over. */
  clearSession(sessionId: string): void {
    if (sessionId !== this.shownSession) return;
    this.lastMessageId = 0;
    this.list.render([emptySessionItem()]);
  }

  /** A live line from any session; shown only if that session is open. */
  addSessionMessage({ session, message }: SessionChatLine): void {
    if (session !== this.shownSession || message.id <= this.lastMessageId) return;
    if (this.lastMessageId === 0) this.list.render([]);
    this.lastMessageId = message.id;
    this.list.append(sessionItem(message));
  }
}
