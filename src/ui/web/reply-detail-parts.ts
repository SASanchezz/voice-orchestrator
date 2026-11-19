// The selected reply, right of the list: who and where, the conversation as chat bubbles (theirs left, yours right),
// and your draft as the next bubble, with the tools to dictate, edit, dismiss or send it.

import type { ReplyContextLine, ReplyDraftView } from "../reply-views.js";
import { el } from "./dom.js";
import { avatar, kindPill, sourceBadge, timeLabel, urgencyPill, whereLabel } from "./reply-look.js";

const YOU = "You";

/** The pane's elements, built once and kept while the draft waits. */
export interface DetailParts {
  detail: HTMLElement;
  header: HTMLElement;
  thread: HTMLOListElement;
  form: HTMLFormElement;
  input: HTMLTextAreaElement;
  mic: HTMLButtonElement;
  cancel: HTMLButtonElement;
  target: HTMLElement;
  edit: HTMLButtonElement;
  dismiss: HTMLButtonElement;
  send: HTMLButtonElement;
  status: HTMLElement;
}

export function detailParts(): DetailParts {
  const header = el("header", { class: "reply-detail-header" });
  const loading = el("li", { class: "reply-thread-note" }, "Loading the conversation…");
  const thread = el("ol", { class: "reply-thread", "aria-label": "The conversation" }, loading);
  const tools = toolParts();
  const input = el("textarea", { class: "reply-text", rows: "3", "aria-label": "Your reply" });
  const label = el("span", { class: "reply-draft-label" }, "Your draft");
  const draftBubble = el("div", { class: "reply-draft" }, label, input);
  const form = el("form", { class: "reply-form" }, draftBubble, toolbar(tools), voiceHint());
  const detail = el("article", { class: "reply-detail", hidden: "" }, header, thread, form);
  return { ...tools, detail, header, thread, form, input };
}

type ToolParts = Pick<DetailParts, "mic" | "cancel" | "target" | "edit" | "dismiss" | "send" | "status">;

function toolParts(): ToolParts {
  return {
    mic: el("button", { type: "button", class: "ghost mic-button" }, "🎙"),
    cancel: el("button", { type: "button", class: "ghost mic-cancel", title: "Cancel the recording", hidden: "" }, "✕"),
    target: el("span", { class: "mic-target", hidden: "" }),
    status: el("span", { class: "reply-status", role: "status" }),
    edit: el("button", { type: "button", class: "ghost", title: "Edit the draft (E)" }, "✎ Edit"),
    dismiss: el(
      "button",
      { type: "button", class: "ghost reply-dismiss", title: "Don't reply; drop the draft" },
      "Dismiss",
    ),
    send: el("button", { type: "submit", class: "primary reply-send", title: "Send this reply (⌘↵)" }, "Send"),
  };
}

/** 🎙 and its ✕ on the left; Dismiss, Edit and Send on the right, Send the one to reach for. */
function toolbar({ mic, cancel, target, status, edit, dismiss, send }: ToolParts): HTMLElement {
  const sendHint = el("kbd", { class: "reply-send-keys" }, "⌘↵");
  send.append(" ", sendHint);
  return el("div", { class: "reply-actions" }, mic, cancel, target, status, dismiss, edit, send);
}

function voiceHint(): HTMLElement {
  return el("p", { class: "reply-voice-hint" }, "🎙 Say “confirm send” to send this reply, exactly as shown.");
}

export function renderDetailHeader(header: HTMLElement, view: ReplyDraftView): void {
  const name = el("h2", { class: "reply-detail-name" }, view.from);
  const where = el(
    "p",
    { class: "reply-detail-where" },
    sourceBadge(view.source),
    whereLabel(view),
    " · ",
    timeLabel(view.createdAt),
  );
  const tags = el("div", { class: "reply-row-tags" }, kindPill(view.kind), urgencyPill(view.urgency));
  header.replaceChildren(avatar(view.from, "large"), el("div", { class: "reply-detail-title" }, name, where), tags);
}

/** The conversation's latest lines as bubbles; empty when it can't be read right now. */
export function renderThread(thread: HTMLOListElement, lines: ReplyContextLine[]): void {
  if (!lines.length)
    return thread.replaceChildren(
      el("li", { class: "reply-thread-note" }, "The conversation couldn't be read right now."),
    );
  thread.replaceChildren(...lines.map(bubble));
}

function bubble({ from, text, sentAt }: ReplyContextLine): HTMLLIElement {
  const isMine = from === YOU;
  const author = el("span", { class: "reply-bubble-author" }, isMine ? YOU : from, " · ", timeLabel(sentAt));
  return el("li", { class: `reply-bubble ${isMine ? "mine" : "theirs"}` }, author, el("p", {}, text));
}
