import { EventEmitter } from "node:events";
import type { WorkerQuestion } from "../questions/question-input.js";

/** Who an event is about: the session, and how to name it aloud ("webshop" or "webshop session 2"). */
export interface EventSubject {
  project: string;
  session: string;
  label: string;
}

/** Which task ended, so its announcement can name the session and say what it was about. */
interface TaskSubject {
  task: string;
  sessionNumber: number;
}

/** Events the orchestrator turns into speech. */
export type AppEvent = EventSubject &
  (
    | (TaskSubject & { kind: "task_done"; result: string })
    | (TaskSubject & { kind: "task_failed"; error: string })
    | { kind: "usage_limit"; account: string; resetsAt?: string; savedTasks: number }
    | { kind: "permission"; id: string; description: string; destructiveVerb?: string; reminder?: boolean }
    | { kind: "question"; id: string; questions: WorkerQuestion[] }
    | { kind: "context_full"; sessionNumber: number; percent: number }
  );

export type UsageLimitEvent = Extract<AppEvent, { kind: "usage_limit" }>;
export type TaskEndEvent = Extract<AppEvent, { kind: "task_done" | "task_failed" }>;
export type PermissionEvent = Extract<AppEvent, { kind: "permission" }>;
export type QuestionEvent = Extract<AppEvent, { kind: "question" }>;
export type ContextFullEvent = Extract<AppEvent, { kind: "context_full" }>;

/** A worker session by project, id and number, so the UI can open it. */
export interface SessionLink {
  project: string;
  id: string;
  number: number;
}

export function sessionLinkOf(e: TaskEndEvent): SessionLink {
  return { project: e.project, id: e.session, number: e.sessionNumber };
}

/**
 * What happens to workers and sessions, for whoever turns it into speech, chat lines or UI updates.
 * Emits "event" with an AppEvent, "session_removed" / "session_cleared" with a session id,
 * "permission_explained" with a request id and its explanation, "permission_closed" with a request id,
 * and "question_closed" with the id of a worker's questions.
 */
export class AppEvents extends EventEmitter {
  emitEvent(event: AppEvent): void {
    this.emit("event", event);
  }

  emitSessionRemoved(sessionId: string): void {
    this.emit("session_removed", sessionId);
  }

  emitSessionCleared(sessionId: string): void {
    this.emit("session_cleared", sessionId);
  }

  emitPermissionExplained(requestId: string, explanation: string): void {
    this.emit("permission_explained", requestId, explanation);
  }

  /** The request was answered (by voice, click or pop-up) or its worker stopped. */
  emitPermissionClosed(requestId: string): void {
    this.emit("permission_closed", requestId);
  }

  /** The questions were answered or skipped (in the web UI or a pop-up), or their worker stopped. */
  emitQuestionClosed(questionsId: string): void {
    this.emit("question_closed", questionsId);
  }
}
