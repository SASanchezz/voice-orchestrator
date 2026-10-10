// The center chat: the orchestrator's conversation, or one worker session's own message history.

import { el, collapsible, formatTime } from "./dom.js";

const SESSION_WHO = { task: "Task", reply: "Worker", tool: "Step", status: "Status", permission: "Approval" };
const SESSION_KIND_CLASS = { task: "user", reply: "orchestrator", tool: "event", status: "event", permission: "event" };

export class ChatView {
  constructor(token) {
    this.token = token;
    this.list = document.getElementById("feed");
    this.wrap = document.querySelector(".feed-wrap");
    this.orchestratorEntries = [];
    this.shownSession = undefined; // undefined: the orchestrator's chat is shown
    this.lastMessageId = 0;
  }

  /** The orchestrator's timeline as the server had it when the page connected. */
  setOrchestratorBacklog(entries) {
    this.orchestratorEntries = entries;
    if (!this.shownSession) this.render(entries.map(feedItem));
  }

  addOrchestratorEntry(entry) {
    this.orchestratorEntries.push(entry);
    if (!this.shownSession) this.append(feedItem(entry));
  }

  showOrchestrator() {
    if (!this.shownSession) return;
    this.shownSession = undefined;
    this.render(this.orchestratorEntries.map(feedItem));
  }

  async showSession(sessionId) {
    if (this.shownSession === sessionId) return;
    this.shownSession = sessionId;
    this.lastMessageId = 0;
    this.render([]);
    const messages = await this.fetchMessages(sessionId);
    if (this.shownSession !== sessionId) return; // switched again while loading
    messages.forEach((m) => this.addSessionMessage({ session: sessionId, message: m }));
    if (!messages.length) this.renderEmptySession();
  }

  /** A session's chat was wiped on the server; its message ids start over. */
  clearSession(sessionId) {
    if (sessionId !== this.shownSession) return;
    this.lastMessageId = 0;
    this.renderEmptySession();
  }

  renderEmptySession() {
    this.render([el("li", { class: "empty" }, "No messages in this session yet. Send it a task below.")]);
  }

  /** A live line from any session; shown only if that session is open. */
  addSessionMessage({ session, message }) {
    if (session !== this.shownSession || message.id <= this.lastMessageId) return;
    if (this.lastMessageId === 0) this.render([]);
    this.lastMessageId = message.id;
    this.append(sessionItem(message));
  }

  async fetchMessages(sessionId) {
    const res = await fetch(`/api/sessions/${sessionId}/messages?token=${encodeURIComponent(this.token)}`);
    return res.ok ? res.json() : [];
  }

  render(items) {
    this.list.replaceChildren(...items);
    this.wrap.scrollTop = this.wrap.scrollHeight;
  }

  append(item) {
    const atBottom = this.wrap.scrollHeight - this.wrap.scrollTop - this.wrap.clientHeight < 40;
    this.list.append(item);
    if (atBottom) this.wrap.scrollTop = this.wrap.scrollHeight;
  }
}

function feedItem(entry) {
  const who = { user: entry.source === "voice" ? "You (voice)" : "You", orchestrator: "Assistant", event: entry.about, action: entry.about ?? "You" }[entry.kind];
  return chatItem(entry.kind, who, entry, entry.detail ? collapsible("Details", entry.detail) : "");
}

function sessionItem(message) {
  return chatItem(SESSION_KIND_CLASS[message.kind], SESSION_WHO[message.kind], message, "");
}

function chatItem(kindClass, who, line, extra) {
  const failed = line.failed ? " failed" : "";
  return el("li", { class: `entry ${kindClass}${failed}` },
    el("div", { class: "entry-meta" }, el("span", {}, who ?? ""), el("span", {}, formatTime(line.at))),
    el("div", { class: "entry-text" }, line.text),
    extra);
}
