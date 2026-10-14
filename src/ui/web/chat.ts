// The center chat: the orchestrator's conversation, or one worker session's own message history.

import type { FeedEntryView, SessionChatLine } from "../protocol.js";
import { fetchSessionMessages } from "./api.js";
import { feedItem, feedItems } from "./chat-items.js";
import { ChatList } from "./chat-list.js";
import { showConfirmButtons } from "./confirm-buttons.js";
import { latestTaskEnd, replyLineIds } from "../task-reply.js";
import { chatRows, joinsPermissionRow } from "../permission-lines.js";
import { permissionRowItem } from "./permission-items.js";
import { SessionFeed } from "./session-feed.js";

export class ChatView {
  private list = new ChatList();
  private orchestratorEntries: FeedEntryView[] = [];
  /** undefined: the orchestrator's chat is shown */
  private shownSession?: string;
  private sessionFeed = new SessionFeed(this.list);

  /** The orchestrator's timeline as the server had it when the page connected. */
  setOrchestratorBacklog(entries: FeedEntryView[]): void {
    this.orchestratorEntries = entries;
    if (!this.shownSession) this.renderOrchestrator();
  }

  /** A permission answer right after another about the same session joins its folded line. */
  addOrchestratorEntry(entry: FeedEntryView): void {
    const joins = joinsPermissionRow(this.orchestratorEntries.at(-1), entry);
    this.orchestratorEntries.push(entry);
    if (this.shownSession) return;
    if (joins) this.list.replaceLast(permissionRowItem(chatRows(this.orchestratorEntries).at(-1) ?? [entry]));
    else this.list.append(feedItem(entry));
    showConfirmButtons(this.list, this.orchestratorEntries);
  }

  showOrchestrator(): void {
    if (!this.shownSession) return;
    this.shownSession = undefined;
    this.renderOrchestrator();
  }

  private renderOrchestrator(): void {
    this.list.render(feedItems(this.orchestratorEntries));
    showConfirmButtons(this.list, this.orchestratorEntries);
  }

  /** Points out the assistant's reply to the session's latest ended task, in its chat, which must be the one shown. */
  revealTaskReply(sessionId: string): void {
    const ended = latestTaskEnd(this.orchestratorEntries, sessionId);
    if (ended) this.list.highlight(replyLineIds(this.orchestratorEntries, ended));
  }

  async showSession(sessionId: string): Promise<void> {
    if (this.shownSession === sessionId) return;
    this.shownSession = sessionId;
    this.sessionFeed.start(sessionId);
    const messages = await fetchSessionMessages(sessionId);
    if (this.shownSession !== sessionId) return; // switched again while loading
    messages.forEach((message) => this.sessionFeed.add(message));
    if (!messages.length) this.sessionFeed.showEmpty();
  }

  /** A session's chat was wiped on the server; its message ids start over. */
  clearSession(sessionId: string): void {
    if (sessionId === this.shownSession) this.sessionFeed.clear();
  }

  /** A live line from any session; shown only if that session is open. */
  addSessionMessage({ session, message }: SessionChatLine): void {
    if (session === this.shownSession) this.sessionFeed.add(message);
  }
}
