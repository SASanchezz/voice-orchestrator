// The assistant's open request for a confirm phrase, which the chat answers with Confirm and Cancel buttons.
// The server says which verbs are asked (the assistant's ask_to_confirm tool); the reply's wording never does.
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
  const latest = entries.findLast(isConversationLine);
  if (latest?.kind !== "orchestrator") return undefined;
  return { entryId: latest.id, verbs };
}

function isConversationLine(entry: FeedEntryView): boolean {
  return entry.kind === "user" || entry.kind === "orchestrator";
}

/** What a Confirm click says for you, e.g. "confirm push". */
export function confirmWords(verb: string): string {
  return `confirm ${verb}`;
}

/** What a Cancel click says for you, e.g. "Cancel, don't push or delete." */
export function cancelWords(verbs: string[]): string {
  return `Cancel, don't ${verbs.join(" or ")}.`;
}
