// Closing many of a project's sessions at once, from a session tab's menu: which close, which are skipped because
// their worker is running, and what that is called. No imports but running-tasks, so the page bundles it and the
// server uses the same rules.

import type { SessionView } from "./protocol.js";
import { isBusy } from "./running-tasks.js";

/** A busy session's worker is never stopped by a sweep; it stays open. */
export interface SessionSweep {
  closing: SessionView[];
  skipped: SessionView[];
}

/** Every session of the project but the kept one, which therefore stays open. */
export function planCloseOthers(sessions: SessionView[], keptId: string): SessionSweep {
  return splitByRunning(sessions.filter((session) => session.id !== keptId));
}

/** Closing every idle session can leave none; the registry then opens a fresh one, so the project keeps one. */
export function planCloseAll(sessions: SessionView[]): SessionSweep {
  return splitByRunning(sessions);
}

function splitByRunning(sessions: SessionView[]): SessionSweep {
  return { closing: sessions.filter(isIdle), skipped: sessions.filter(isBusy) };
}

function isIdle(session: SessionView): boolean {
  return !isBusy(session);
}

/** What a sweep did, for the feed and the note under the tabs. */
export function sweepReport(project: string, sweep: SessionSweep): string {
  const closed = sweep.closing.length
    ? `Closed ${project} ${sessionList(sweep.closing)}.`
    : `Closed no ${project} sessions.`;
  return `${closed}${skippedReport(sweep.skipped)}`;
}

/** The fresh session is only there when nothing was skipped, since a skipped session stays open. */
export function closeAllReport(project: string, sweep: SessionSweep): string {
  const fresh = sweep.skipped.length ? "" : " A new empty session is open in their place.";
  return `${sweepReport(project, sweep)}${fresh}`;
}

function skippedReport(skipped: SessionView[]): string {
  if (!skipped.length) return "";
  const why =
    skipped.length === 1 ? "its worker is running, so it stays open" : "their workers are running, so they stay open";
  return ` Skipped ${sessionList(skipped)}: ${why}.`;
}

/** The question "Close all sessions" asks before it closes anything. */
export function closeAllWarning(sweep: SessionSweep): string {
  const closing = `${sessionCount(sweep.closing.length)} will be closed: ${sessionList(sweep.closing)}.`;
  const deleted = " Their messages, queue and history are deleted.";
  return `${closing}${deleted}${runningWarning(sweep.skipped)}`;
}

function runningWarning(skipped: SessionView[]): string {
  if (!skipped.length) return " None are running; a new empty session opens in their place.";
  return ` ${skipped.length} running, skipped and kept open: ${sessionList(skipped)}.`;
}

function sessionCount(count: number): string {
  return count === 1 ? "1 session" : `${count} sessions`;
}

/** "session 2", "sessions 2 and 3", "sessions 1, 2 and 4". */
export function sessionList(sessions: SessionView[]): string {
  const numbers = sessions.map((session) => String(session.number));
  if (numbers.length < 2) return `session ${numbers.join("")}`;
  return `sessions ${numbers.slice(0, -1).join(", ")} and ${numbers.at(-1)}`;
}
