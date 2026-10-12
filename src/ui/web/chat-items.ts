// The lines of the center chat: the assistant's timeline, or one worker session's messages.

import type { ChatMessageView, FeedEntryView } from "../protocol.js";
import { collapsible, el, formatTime } from "./dom.js";
import { markdownView } from "./markdown-view.js";
import { sessionLink } from "./session-link.js";

const SESSION_WHO: Record<ChatMessageView["kind"], string> = {
  task: "Task",
  reply: "Worker",
  tool: "Step",
  status: "Status",
  permission: "Approval",
};
const SESSION_KIND_CLASS: Record<ChatMessageView["kind"], string> = {
  task: "user",
  reply: "orchestrator",
  tool: "event",
  status: "event",
  permission: "event",
};

export function feedItem(entry: FeedEntryView): HTMLLIElement {
  const who = {
    user: entry.source === "voice" ? "You (voice)" : "You",
    orchestrator: "Assistant",
    event: entry.about,
    action: entry.about ?? "You",
  }[entry.kind];
  const item = chatItem(entry.kind, who, entry);
  item.dataset.entry = String(entry.id);
  if (entry.detail) item.append(collapsible("Details", markdownView(entry.detail, "more-body")));
  if (entry.session) item.append(sessionLink(entry.session));
  return item;
}

export function sessionItem(message: ChatMessageView): HTMLLIElement {
  return chatItem(SESSION_KIND_CLASS[message.kind], SESSION_WHO[message.kind], message);
}

export function emptySessionItem(): HTMLLIElement {
  return el("li", { class: "empty" }, "No messages in this session yet. Send it a task below.");
}

function chatItem(kindClass: string, who: string | undefined, line: FeedEntryView | ChatMessageView): HTMLLIElement {
  const failed = line.failed ? " failed" : "";
  return el(
    "li",
    { class: `entry ${kindClass}${failed}` },
    el("div", { class: "entry-meta" }, el("span", {}, who ?? ""), el("span", {}, formatTime(line.at))),
    entryText(kindClass, line.text),
  );
}

/** Answers (the assistant's, a worker's) are markdown; what you typed and status lines stay as written. */
function entryText(kindClass: string, text: string): HTMLDivElement {
  return kindClass === "orchestrator" ? markdownView(text, "entry-text") : el("div", { class: "entry-text" }, text);
}
