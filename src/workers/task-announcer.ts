import type { AppEvents } from "../events/app-events.js";
import type { RunningTask } from "./running-task.js";
import type { WorkerChat } from "./worker-chat.js";
import type { WorkerDirectory } from "./worker-directory.js";

/** The end of the worker's closing note that is passed on; the rest stays in its chat and history. */
const RESULT_CHARS = 1200;

/** Tells the orchestrator (an event) and the session's chat (a status line) how a task ended. */
export class TaskAnnouncer {
  constructor(
    private events: AppEvents,
    private chat: WorkerChat,
    private directory: WorkerDirectory,
  ) {}

  done(task: RunningTask, result: string): void {
    this.events.emitEvent({ kind: "task_done", ...this.subject(task), result: result.slice(-RESULT_CHARS) });
  }

  finished(task: RunningTask): void {
    this.chat.say(task.sessionId, "status", "Finished.");
  }

  failed(task: RunningTask, error: string): void {
    this.events.emitEvent({ kind: "task_failed", ...this.subject(task), error });
    this.chat.sayFailure(task.sessionId, `Failed: ${error}`);
  }

  stopped(task: RunningTask): void {
    this.chat.say(task.sessionId, "status", "Stopped.");
  }

  private subject(task: RunningTask) {
    const { project, sessionId: session, instruction, sessionNumber } = task;
    return { project, session, label: this.directory.labelOf(session), task: instruction, sessionNumber };
  }
}
