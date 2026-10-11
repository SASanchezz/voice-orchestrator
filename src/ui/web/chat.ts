// The center chat: the orchestrator's conversation, or one worker session's own message history.

import type { ChatMessageView, FeedEntryView, SessionChatLine } from "../protocol.js";
import { el, collapsible, formatTime, byId, type Child } from "./dom.js";
import { fetchSessionMessages } from "./api.js";

const SESSION_WHO: Record<ChatMessageView["kind"], string> = { task: "Task", reply: "Worker", tool: "Step", status: "Status", permission: "Approval" };
const SESSION_KIND_CLASS: Record<ChatMessageView["kind"], string> = { task: "user", reply: "orchestrator", tool: "event", status: "event", permission: "event" };
/** How close to the bottom counts as reading the newest messages, so new ones scroll into view. */
const STICK_TO_BOTTOM_PX = 40;

export class ChatView {
  private list = byId<HTMLOListElement>("feed");
  private wrap = document.querySelector<HTMLElement>(".feed-wrap")!;
  private orchestratorEntries: FeedEntryView[] = [];
  /** undefined: the orchestrator's chat is shown */
  private shownSession?: string;
  private lastMessageId = 0;

  /** The orchestrator's timeline as the server had it when the page connected. */
  setOrchestratorBacklog(entries: FeedEntryView[]) {
    this.orchestratorEntries = entries;
    if (!this.shownSession) this.render(entries.map(feedItem));
  }

  addOrchestratorEntry(entry: FeedEntryView) {
    this.orchestratorEntries.push(entry);
    if (!this.shownSession) this.append(feedItem(entry));
  }

  showOrchestrator() {
    if (!this.shownSession) return;
    this.shownSession = undefined;
    this.render(this.orchestratorEntries.map(feedItem));
  }

  async showSession(sessionId: string) {
    if (this.shownSession === sessionId) return;
    this.shownSession = sessionId;
    this.lastMessageId = 0;
    this.render([]);
    const messages = await fetchSessionMessages(sessionId);
    if (this.shownSession !== sessionId) return; // switched again while loading
    messages.forEach((message) => this.addSessionMessage({ session: sessionId, message }));
    if (!messages.length) this.renderEmptySession();
  }

  /** A session's chat was wiped on the server; its message ids start over. */
  clearSession(sessionId: string) {
    if (sessionId !== this.shownSession) return;
    this.lastMessageId = 0;
    this.renderEmptySession();
  }

  /** A live line from any session; shown only if that session is open. */
  addSessionMessage({ session, message }: SessionChatLine) {
    if (session !== this.shownSession || message.id <= this.lastMessageId) return;
    if (this.lastMessageId === 0) this.render([]);
    this.lastMessageId = message.id;
    this.append(sessionItem(message));
  }

  private renderEmptySession() {
    this.render([el("li", { class: "empty" }, "No messages in this session yet. Send it a task below.")]);
  }

  private render(items: HTMLLIElement[]) {
    this.list.replaceChildren(...items);
    this.wrap.scrollTop = this.wrap.scrollHeight;
  }

  private append(item: HTMLLIElement) {
    const atBottom = this.wrap.scrollHeight - this.wrap.scrollTop - this.wrap.clientHeight < STICK_TO_BOTTOM_PX;
    this.list.append(item);
    if (atBottom) this.wrap.scrollTop = this.wrap.scrollHeight;
  }
}

function feedItem(entry: FeedEntryView): HTMLLIElement {
  const who = { user: entry.source === "voice" ? "You (voice)" : "You", orchestrator: "Assistant", event: entry.about, action: entry.about ?? "You" }[entry.kind];
  return chatItem(entry.kind, who, entry, entry.detail ? collapsible("Details", entry.detail) : "");
}

function sessionItem(message: ChatMessageView): HTMLLIElement {
  return chatItem(SESSION_KIND_CLASS[message.kind], SESSION_WHO[message.kind], message, "");
}

function chatItem(kindClass: string, who: string | undefined, line: FeedEntryView | ChatMessageView, extra: Child): HTMLLIElement {
  const failed = line.failed ? " failed" : "";
  return el("li", { class: `entry ${kindClass}${failed}` },
    el("div", { class: "entry-meta" }, el("span", {}, who ?? ""), el("span", {}, formatTime(line.at))),
    el("div", { class: "entry-text" }, line.text),
    extra);
}
