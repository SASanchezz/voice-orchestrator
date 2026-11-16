// The center chat: the orchestrator's conversation, or one worker session's own message history.

import type { FeedEntryView, PendingRequestView, SessionChatLine } from "../protocol.js";
import { feedItem, feedItems } from "./chat-items.js";
import { ChatList } from "./chat-list.js";
import { ConfirmButtons } from "./confirm-buttons.js";
import { latestTaskEnd, replyLineIds } from "../task-reply.js";
import { chatRows, joinsPermissionRow } from "../permission-lines.js";
import { permissionRowItem } from "./permission-items.js";
import { ShownSessionChat } from "./shown-session-chat.js";

export class ChatView {
  private list = new ChatList();
  private confirmButtons = new ConfirmButtons(this.list);
  private orchestratorEntries: FeedEntryView[] = [];
  /** While it shows nothing, the orchestrator's chat is shown. */
  private session = new ShownSessionChat(this.list);

  /** The orchestrator's timeline as the server had it when the page connected. */
  setOrchestratorBacklog(entries: FeedEntryView[]): void {
    this.orchestratorEntries = entries;
    if (!this.session.isShowing()) this.renderOrchestrator();
  }

  /** A permission answer right after another about the same session joins its folded line. */
  addOrchestratorEntry(entry: FeedEntryView): void {
    const joins = joinsPermissionRow(this.orchestratorEntries.at(-1), entry);
    this.orchestratorEntries.push(entry);
    if (this.session.isShowing()) return;
    if (joins) this.list.replaceLast(permissionRowItem(chatRows(this.orchestratorEntries).at(-1) ?? [entry]));
    else this.list.append(feedItem(entry));
    this.confirmButtons.show(this.orchestratorEntries);
  }

  showOrchestrator(): void {
    if (!this.session.isShowing()) return;
    this.session.hide();
    this.renderOrchestrator();
  }

  private renderOrchestrator(): void {
    this.list.render(feedItems(this.orchestratorEntries));
    this.confirmButtons.show(this.orchestratorEntries);
  }

  /** Points out the assistant's reply to the session's latest ended task, in its chat, which must be the one shown. */
  revealTaskReply(sessionId: string): void {
    const ended = latestTaskEnd(this.orchestratorEntries, sessionId);
    if (ended) this.list.highlight(replyLineIds(this.orchestratorEntries, ended));
  }

  showSession(sessionId: string): Promise<void> {
    return this.session.show(sessionId);
  }

  /** A session's chat was wiped on the server; its message ids start over. */
  clearSession(sessionId: string): void {
    this.session.clear(sessionId);
  }

  /** Marks which of the shown session's permission requests still wait for an answer. */
  showPendingApprovals(pending: PendingRequestView[]): void {
    this.session.showPendingApprovals(pending);
  }

  /** A live line from any session; shown only if that session is open. */
  addSessionMessage(line: SessionChatLine): void {
    this.session.add(line);
  }
}
