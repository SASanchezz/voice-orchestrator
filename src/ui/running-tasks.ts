// Which worker tasks are running, and what restarting the app would stop.
// No runtime imports, so the page bundles it and Node tests it.

import type { ProjectView, SessionStatus, SessionView } from "./protocol.js";

const BUSY_STATUSES: SessionStatus[] = ["running", "waiting_permission"];

export function isBusy(session: SessionView): boolean {
  return BUSY_STATUSES.includes(session.status);
}

/** Tasks in progress across every project, including those waiting for your permission. */
export function runningTaskCount(projects: ProjectView[]): number {
  return projects.flatMap((project) => project.sessions).filter(isBusy).length;
}

export function restartWarning(runningTasks: number): string {
  const tasks = runningTasks === 1 ? "1 running task" : `${runningTasks} running tasks`;
  return `${tasks} will be stopped. Projects, sessions, history and notes are kept.`;
}
