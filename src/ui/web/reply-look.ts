// How a drafted reply looks in the Messages view: who it is from (an avatar of their initials), the messenger, why it
// was drafted and how urgent it is, each said in words as well as colour.

import type { ReplyDraftView } from "../reply-views.js";
import { compactWhen } from "../reply-when.js";
import { el, formatWhen } from "./dom.js";

const HUE_STEPS = 360;
const HASH_MULTIPLIER = 31;
const MAX_INITIALS = 2;

const KIND_LABELS: Record<string, string> = {
  chat: "Chat",
  question: "Question",
  request: "Request",
  "code-question": "Code question",
  fyi: "FYI",
};

const URGENCY_LABELS: Record<ReplyDraftView["urgency"], string> = { high: "Urgent", normal: "", low: "Low" };

/** A round badge of the person's initials, in a colour that stays theirs. */
export function avatar(name: string, size: "small" | "large"): HTMLElement {
  const node = el("span", { class: `reply-avatar ${size}`, "aria-hidden": "true" }, initialsOf(name));
  node.style.setProperty("--hue", String(hueOf(name)));
  return node;
}

/** "Slack" or "Telegram", tinted like the messenger. */
export function sourceBadge(source: string): HTMLElement {
  const tone = source.startsWith("Telegram") ? "telegram" : "slack";
  return el("span", { class: `reply-source ${tone}` }, source);
}

export function kindPill(kind: string): HTMLElement {
  return el("span", { class: `reply-pill kind-${kind}` }, KIND_LABELS[kind] ?? kind);
}

/** Only urgent and low get a label; normal is the quiet default. */
export function urgencyPill(urgency: ReplyDraftView["urgency"]): HTMLElement | "" {
  const label = URGENCY_LABELS[urgency];
  return label ? el("span", { class: `reply-pill urgency-${urgency}` }, label) : "";
}

/** "12m", "14:05" or "Yesterday", with the exact time on hover. */
export function timeLabel(iso: string): HTMLElement {
  return el("time", { datetime: iso, title: formatWhen(iso) }, compactWhen(new Date(iso), new Date()));
}

/** A DM is the person; a group DM or channel is named. */
export function whereLabel({ chatKind, chatName }: ReplyDraftView): string {
  return chatKind === "dm" ? "Direct message" : chatName;
}

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, MAX_INITIALS).map(firstLetterOf).join("").toUpperCase() || "?";
}

/** A whole character, so a name starting with an emoji or an accented letter keeps it intact. */
function firstLetterOf(word: string): string {
  const [first] = new Intl.Segmenter().segment(word);
  return first?.segment ?? "";
}

function hueOf(name: string): number {
  let hash = 0;
  for (let index = 0; index < name.length; index++)
    hash = (hash * HASH_MULTIPLIER + name.charCodeAt(index)) % HUE_STEPS;
  return hash;
}
