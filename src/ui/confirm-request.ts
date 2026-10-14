// The assistant's open request for a confirm phrase, which the chat answers with Confirm and Cancel buttons.
// No runtime imports, so the page bundles it and Node tests it.

import type { FeedEntryView } from "./protocol.js";

/** "confirm push" in straight or curly double quotes, as the assistant is told to write the phrase it asks for. */
const QUOTED_PHRASE = /["“”]confirm ([a-z]+)["“”]/gi;

/** The assistant's line that asks for the phrase, and the verbs it offers, e.g. ["update", "delete"]. */
export interface ConfirmRequest {
  entryId: number;
  verbs: string[];
}

/** Each verb of the confirm phrases a line asks for, once. */
export function requestedVerbs(text: string): string[] {
  const verbs = [...text.matchAll(QUOTED_PHRASE)].map(([, verb]) => verb.toLowerCase());
  return [...new Set(verbs)];
}

/** The assistant's latest request for a confirm phrase, while you haven't said or typed anything since. */
export function openConfirmRequest(entries: FeedEntryView[]): ConfirmRequest | undefined {
  const latest = entries.findLast((entry) => entry.kind === "user" || asksToConfirm(entry));
  if (latest?.kind !== "orchestrator") return undefined;
  return { entryId: latest.id, verbs: requestedVerbs(latest.text) };
}

function asksToConfirm(entry: FeedEntryView): boolean {
  return entry.kind === "orchestrator" && requestedVerbs(entry.text).length > 0;
}
