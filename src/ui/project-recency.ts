// The order of the project list: projects with work in progress first, then the most recently active.
// No runtime imports, so the page bundles it and Node tests it.

import type { ProjectView, SessionView } from "./protocol.js";
import { isBusy } from "./running-tasks.js";

/** Sorts busy projects first, then by their latest task start, end or queued instruction; ties keep their order. */
export function byRecentActivity(projects: ProjectView[]): ProjectView[] {
  return projects.toSorted(compareActivity);
}

function compareActivity(a: ProjectView, b: ProjectView): number {
  const busyFirst = Number(isProjectBusy(b)) - Number(isProjectBusy(a));
  return busyFirst || latestActivityOf(b).localeCompare(latestActivityOf(a));
}

function isProjectBusy(project: ProjectView): boolean {
  return project.sessions.some(isBusy);
}

/** ISO times compare as strings; a project that never did anything sorts last. */
function latestActivityOf(project: ProjectView): string {
  const times = project.sessions.flatMap(activityTimesOf);
  return times.reduce((latest, time) => (time > latest ? time : latest), "");
}

function activityTimesOf(session: SessionView): string[] {
  const times = [session.startedAt, session.finishedAt, session.queuedAt];
  return times.filter((time) => time !== undefined);
}
