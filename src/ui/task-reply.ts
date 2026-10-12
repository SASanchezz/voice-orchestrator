// Which lines of the assistant's chat answer an ended task. No runtime imports, so the page bundles it and Node tests it.

import type { FeedEntryView } from "./protocol.js";

/**
 * The ids of the assistant's lines relaying `ended`'s answer: its lines after the task's line that link
 * the same session, up to that session's next ended task. Until the reply arrives, the task's own line.
 */
export function replyLineIds(entries: FeedEntryView[], ended: FeedEntryView): number[] {
  const sameSession = (entry: FeedEntryView) => entry.session?.id === ended.session?.id;
  const later = entries.filter((entry) => entry.id > ended.id);
  const nextEnd = later.find((entry) => entry.taskOutcome && sameSession(entry))?.id ?? Number.POSITIVE_INFINITY;
  const reply = later.filter((entry) => entry.id < nextEnd && entry.kind === "orchestrator" && sameSession(entry));
  return reply.length ? reply.map((entry) => entry.id) : [ended.id];
}

/** The line of the session's latest ended task, if the chat still has one. */
export function latestTaskEnd(entries: FeedEntryView[], sessionId: string): FeedEntryView | undefined {
  return entries.findLast((entry) => entry.taskOutcome !== undefined && entry.session?.id === sessionId);
}
