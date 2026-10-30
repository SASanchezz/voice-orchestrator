// How far a to-do item's run has got, read off the session it was sent to.
// No runtime imports, so the page bundles it and Node tests it.

import type { ProjectView, SessionStatus, SessionView, TodoItemView, TodoRunView } from "./protocol.js";
import { isBusy } from "./running-tasks.js";

/** queued: behind the session's running task. sent: no trace of it in the session yet. closed: the session is gone. */
export type TodoRunState = SessionStatus | "queued" | "sent" | "closed";

/** A run with the session it went to, while that session is open. */
export interface PlacedRun {
  item: TodoItemView;
  run: TodoRunView;
  session?: SessionView;
  state: TodoRunState;
}

const ACTIVE_STATES: TodoRunState[] = ["running", "waiting_permission", "queued"];

export function isActive(state: TodoRunState): boolean {
  return ACTIVE_STATES.includes(state);
}

/** Every run of the items, each with its session and state, in the order the items and their runs are listed. */
export function placeRuns(items: TodoItemView[], projects: ProjectView[]): PlacedRun[] {
  const sessions = projects.flatMap((project) => project.sessions);
  return items.flatMap((item) => item.runs.map((run) => placeRun(item, run, sessions)));
}

function placeRun(item: TodoItemView, run: TodoRunView, sessions: SessionView[]): PlacedRun {
  const session = sessions.find((candidate) => candidate.id === run.sessionId);
  return { item, run, session, state: session ? stateIn(run, session) : "closed" };
}

/** The session's current task first: a task sent twice may be both running and queued again. */
function stateIn(run: TodoRunView, session: SessionView): TodoRunState {
  const isCurrent = session.task === run.instruction;
  if (isCurrent && isBusy(session)) return session.status;
  if (session.queued.includes(run.instruction)) return "queued";
  if (isCurrent) return session.status;
  return outcomeIn(run, session);
}

function outcomeIn(run: TodoRunView, session: SessionView): TodoRunState {
  const finished = session.history.findLast((record) => record.task === run.instruction);
  return finished?.outcome ?? "sent";
}
