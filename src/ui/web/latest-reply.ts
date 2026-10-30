// The assistant's latest words in the bottom strip, so you can follow it with the chat hidden.

import type { FeedEntryView } from "../protocol.js";
import { byId } from "./dom.js";
import { store } from "./store.js";

export function showLatestReplyOf(entries: FeedEntryView[]): void {
  const latest = entries.findLast(isReply);
  if (latest) showLatestReply(latest);
}

export function showLatestReply(entry: FeedEntryView): void {
  if (!isReply(entry)) return;
  const line = byId("latest-reply", HTMLElement);
  line.textContent = entry.text;
  line.title = entry.text;
}

/** Your own words take the strip while you speak. */
export function renderLatestReply(): void {
  byId("latest-reply", HTMLElement).hidden = store.state.voiceInput !== "idle";
}

function isReply(entry: FeedEntryView): boolean {
  return entry.kind === "orchestrator";
}
