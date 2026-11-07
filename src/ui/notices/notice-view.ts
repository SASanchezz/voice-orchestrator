import type { TaskEndEvent } from "../../events/app-events.js";
import { taskHeadline } from "../../orchestrator/conversation/gist.js";
import type { NoticeView } from "../notice-protocol.js";
import { closingSummary } from "./closing-summary.js";

/** One ended task in the notice panel. */
export interface TaskNotice {
  id: string;
  event: TaskEndEvent;
  /** ISO time. */
  endedAt: string;
  seen: boolean;
  explanation?: string;
}

export function noticeViewOf({ id, event, endedAt, seen, explanation }: TaskNotice): NoticeView {
  const note = noteOf(event);
  const summary = closingSummary(note);
  return {
    id,
    sessionId: event.session,
    project: event.project,
    sessionNumber: event.sessionNumber,
    outcome: event.kind === "task_done" ? "done" : "failed",
    headline: taskHeadline(event),
    task: event.task,
    summary,
    fullNote: summary === note.trim() ? "" : note,
    explanation,
    seen,
    endedAt,
  };
}

/** The worker's whole closing note, or why the task failed. */
function noteOf(event: TaskEndEvent): string {
  return event.kind === "task_done" ? event.note : event.error;
}
