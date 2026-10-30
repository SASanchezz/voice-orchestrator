// Remembers in this browser which sessions' finished work you have seen. The session on screen is seen while the page
// is in front; any other with a new result shines on its tab and its project until you open it.

import type { SessionView } from "../protocol.js";
import { allSeen, hasUnseenResult, type SeenResults, withSeen } from "../unseen-results.js";
import { localRead, localWrite } from "./dom.js";
import { store } from "./store.js";

const SEEN_KEY = "seenResults";

/** Unknown until the server's first state, which the first run counts as all seen. */
let seen: SeenResults | undefined;

export function isUnseen(session: SessionView): boolean {
  return seen !== undefined && hasUnseenResult(session, seen);
}

/** A page coming back to the front sees the session it shows. */
export function wireSeenResults(render: () => void): void {
  document.addEventListener("visibilitychange", () => {
    noteShownSession();
    render();
  });
}

/** Before the page renders: the session on screen has its result seen. */
export function noteShownSession(): void {
  const { projects } = store.state;
  if (!projects.length) return; // the server's first state hasn't come yet
  seen ??= readSeen() ?? remember(allSeen(projects));
  const shown = shownSession();
  if (shown && document.visibilityState === "visible") remember(withSeen(seen, shown));
}

function shownSession(): SessionView | undefined {
  const project = store.selectedProject();
  if (!project || store.projectTodoShown) return undefined;
  return project.sessions.find((session) => session.id === project.activeSession);
}

function remember(next: SeenResults): SeenResults {
  if (next !== seen) localWrite(SEEN_KEY, JSON.stringify(next));
  seen = next;
  return next;
}

function readSeen(): SeenResults | undefined {
  const saved = localRead(SEEN_KEY);
  if (!saved) return undefined;
  const parsed = parseSaved(saved);
  return isSeenResults(parsed) ? parsed : undefined;
}

function parseSaved(saved: string): unknown {
  try {
    return JSON.parse(saved);
  } catch {
    return undefined; // a damaged record starts over as all seen
  }
}

function isSeenResults(value: unknown): value is SeenResults {
  const isRecord = typeof value === "object" && value !== null && !Array.isArray(value);
  return isRecord && Object.values(value).every((finishedAt) => typeof finishedAt === "string");
}
