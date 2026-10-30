// Which sessions finished work you haven't looked at yet: their tab shines until you open it.
// No runtime imports, so the page bundles it and Node tests it.

import type { ProjectView, SessionView } from "./protocol.js";
import { isBusy } from "./running-tasks.js";

/** When each session's latest result was seen: that result's finish time, by session id. */
export type SeenResults = Record<string, string>;

/**
 * Finished work you haven't seen, while the session waits for you; a busy session shines once it is done again. A task
 * you stopped yourself needs no reminder.
 */
export function hasUnseenResult(session: SessionView, seen: SeenResults): boolean {
  const latest = session.history.at(-1);
  const isWaiting = latest !== undefined && latest.outcome !== "stopped" && !isBusy(session);
  return isWaiting && seen[session.id] !== latest.finishedAt;
}

/** The sessions' latest results as seen; the first time the page runs, so it doesn't light up everything at once. */
export function allSeen(projects: ProjectView[]): SeenResults {
  const sessions = projects.flatMap((project) => project.sessions);
  return Object.fromEntries(sessions.map((session) => [session.id, latestFinishOf(session) ?? ""]));
}

/** The same, with the session's latest result seen as well. */
export function withSeen(seen: SeenResults, session: SessionView): SeenResults {
  const latest = latestFinishOf(session);
  if (latest === undefined || seen[session.id] === latest) return seen;
  return { ...seen, [session.id]: latest };
}

function latestFinishOf(session: SessionView): string | undefined {
  return session.history.at(-1)?.finishedAt;
}
