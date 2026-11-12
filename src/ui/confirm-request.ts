// The assistant's open request for a confirm phrase or a go-ahead, which the chat answers with buttons.
// The server says what is asked (the assistant's ask_to_confirm and ask_go_ahead tools); the reply's wording never does.
// No runtime imports, so the page bundles it and Node tests it.

import type { FeedEntryView } from "./protocol.js";

/** The assistant's line the buttons go under, and the verbs they offer, e.g. ["update", "delete"]. */
export interface ConfirmRequest {
  entryId: number;
  verbs: string[];
}

/** Under the assistant's latest line, while you haven't said or typed anything since. */
export function openConfirmRequest(entries: FeedEntryView[], verbs: string[]): ConfirmRequest | undefined {
  if (!verbs.length) return undefined;
  const entryId = latestAssistantLineId(entries);
  return entryId === undefined ? undefined : { entryId, verbs };
}

/** The assistant's line the Yes and Cancel buttons go under, while you haven't said or typed anything since. */
export function openGoAheadLineId(entries: FeedEntryView[], isAsked: boolean): number | undefined {
  return isAsked ? latestAssistantLineId(entries) : undefined;
}

function latestAssistantLineId(entries: FeedEntryView[]): number | undefined {
  const latest = entries.findLast(isConversationLine);
  return latest?.kind === "orchestrator" ? latest.id : undefined;
}

function isConversationLine(entry: FeedEntryView): boolean {
  return entry.kind === "user" || entry.kind === "orchestrator";
}

/** What a Confirm click says for you, e.g. "confirm push". */
export function confirmWords(verb: string): string {
  return `confirm ${verb}`;
}

/** What a Yes click on a go-ahead question says for you. */
export const GO_AHEAD_YES_WORDS = "yes";

/** What a Cancel click on a go-ahead question says for you. */
export const GO_AHEAD_CANCEL_WORDS = "cancel";

/** What a Cancel click says for you, e.g. "Cancel, don't push or delete." */
export function cancelWords(verbs: string[]): string {
  return `Cancel, don't ${verbs.join(" or ")}.`;
}
