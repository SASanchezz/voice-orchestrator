// The lines of the center chat: the assistant's timeline, or one worker session's messages.

import { readAttachmentNote } from "../../attachments/noted-files.js";
import type { ChatMessageView, FeedEntryView } from "../protocol.js";
import { chatRows, permissionAnswerOf } from "../permission-lines.js";
import { collapsible, el, formatTime } from "./dom.js";
import { markdownView } from "./markdown-view.js";
import { permissionItem, permissionRowItem } from "./permission-items.js";
import { sentFiles } from "./sent-files.js";
import { sessionLink } from "./session-link.js";

const SESSION_WHO: Record<ChatMessageView["kind"], string> = {
  task: "Task",
  reply: "Worker",
  tool: "Step",
  status: "Status",
  permission: "Approval",
  question: "Question",
};
const SESSION_KIND_CLASS: Record<ChatMessageView["kind"], string> = {
  task: "user",
  reply: "orchestrator",
  tool: "event",
  status: "event",
  permission: "event",
  question: "event",
};

/** The assistant's timeline, with permission answers in a row about the same session folded into one line. */
export function feedItems(entries: FeedEntryView[]): HTMLLIElement[] {
  return chatRows(entries).map((row) => (row.length > 1 ? permissionRowItem(row) : feedItem(row[0])));
}

export function feedItem(entry: FeedEntryView): HTMLLIElement {
  const answer = permissionAnswerOf(entry);
  if (answer) return permissionItem(entry, answer);
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
    ...entryBody(kindClass, line.text),
  );
}

/** What you sent shows the files attached to it, not the paths listed for the assistant or worker. */
function entryBody(kindClass: string, text: string): (Node | string)[] {
  if (kindClass !== "user") return [entryText(kindClass, text)];
  const noted = readAttachmentNote(text);
  return [noted.text ? entryText(kindClass, noted.text) : "", noted.files.length ? sentFiles(noted.files) : ""];
}

/** Answers (the assistant's, a worker's) are markdown; what you typed and status lines stay as written. */
function entryText(kindClass: string, text: string): HTMLDivElement {
  return kindClass === "orchestrator" ? markdownView(text, "entry-text") : el("div", { class: "entry-text" }, text);
}
