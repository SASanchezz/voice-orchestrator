// The lines of the center chat: the assistant's timeline, or one worker session's messages.

import type { ChatMessageView, FeedEntryView } from "../protocol.js";
import { collapsible, el, formatTime } from "./dom.js";

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
  if (entry.detail) item.append(collapsible("Details", entry.detail));
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
    el("div", { class: "entry-text" }, line.text),
  );
}
