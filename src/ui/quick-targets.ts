// Who the quick panel can send to: the assistant and every open session, the most recently active first, and the line
// that says what the chosen one is doing. No imports but types and pure helpers, so the page bundles it and Node tests it.

import type { ProjectView, SessionStatus, SessionView } from "./protocol.js";
import { firstLine, shortSessionTitle } from "./session-title.js";

export const ASSISTANT_TARGET_ID = "assistant";
const ASSISTANT_NAME = "Assistant";
const ASSISTANT_DETAIL = "starts tasks in any project";

export interface QuickTarget {
  /** A session's id, or ASSISTANT_TARGET_ID. */
  id: string;
  /** Unset for the assistant. */
  project?: string;
  name: string;
  /** Muted beside the name, and searched too: the session's state. */
  detail: string;
  /** Unset for the assistant. */
  status?: SessionStatus;
}

const STATUS_DETAILS: Record<SessionStatus, string> = {
  idle: "idle",
  running: "working",
  waiting_permission: "waiting for you",
  done: "done",
  failed: "failed",
  stopped: "stopped",
};

export const ASSISTANT_TARGET: QuickTarget = {
  id: ASSISTANT_TARGET_ID,
  name: ASSISTANT_NAME,
  detail: ASSISTANT_DETAIL,
};

/** Every open session, the one active most recently first; ties keep the projects' order. */
export function sessionTargetsOf(projects: ProjectView[]): QuickTarget[] {
  const pairs = projects.flatMap((project) => project.sessions.map((session) => ({ project, session })));
  const recentFirst = pairs.toSorted((one, other) =>
    latestActivityOf(other.session).localeCompare(latestActivityOf(one.session)),
  );
  return recentFirst.map(({ project, session }) => sessionTarget(project.name, session));
}

/** The one you sent to last, while it is still open; else the most recently active session; else the assistant. */
export function defaultTargetOf(sessions: QuickTarget[], lastSentTo: string | undefined): QuickTarget {
  if (lastSentTo === ASSISTANT_TARGET_ID) return ASSISTANT_TARGET;
  return sessions.find((target) => target.id === lastSentTo) ?? sessions[0] ?? ASSISTANT_TARGET;
}

/** What the session is busy with, or how its latest task ended, in one line. */
export function sessionContextOf(session: SessionView): string {
  if (session.status === "waiting_permission") return "Waiting for your approval";
  if (session.status === "running") return `Working on: ${firstLine(session.task ?? "")}${queuedNote(session)}`;
  if (session.status === "failed" && session.lastError) return `Failed: ${firstLine(session.lastError)}`;
  const latest = session.history.at(-1);
  return latest ? `Last reply: ${firstLine(latest.result)}` : "No tasks yet";
}

function sessionTarget(project: string, session: SessionView): QuickTarget {
  const name = `${project} › ${shortSessionTitle(session)}`;
  return { id: session.id, project, name, detail: STATUS_DETAILS[session.status], status: session.status };
}

function queuedNote(session: SessionView): string {
  return session.queued.length ? ` (${session.queued.length} queued)` : "";
}

/** ISO times compare as strings; a session that never did anything sorts last. */
function latestActivityOf(session: SessionView): string {
  const times = [session.lastActivity, session.startedAt, session.finishedAt, session.queuedAt];
  return times.reduce<string>((latest, time) => (time && time > latest ? time : latest), "");
}
