import type { SessionView } from "./session-protocol.js";

/** "2 queued", "2 queued, paused", or "" when nothing waits. */
export function queuedLabel({ queued, queuePaused }: SessionView): string {
  if (!queued.length) return "";
  return queuePaused ? `${queued.length} queued, paused` : `${queued.length} queued`;
}
