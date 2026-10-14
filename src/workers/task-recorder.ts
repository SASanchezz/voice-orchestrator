import type { SessionPatch } from "../registry/registry-schema.js";
import type { Sessions } from "../registry/sessions.js";
import type { TaskHistory } from "../registry/task-history.js";
import type { SpendLedger } from "../budget/spend-ledger.js";
import type { RunningTask } from "./running-task.js";

const now = (): string => new Date().toISOString();

/** What a task's start and end write into its session, and into the project's history. */
export class TaskRecorder {
  constructor(
    private sessions: Sessions,
    private history: TaskHistory,
    private ledger: SpendLedger,
  ) {}

  started(task: RunningTask): void {
    this.sessions.updateSession(task.sessionId, startedPatch(task));
  }

  /** `runningTotalUsd` is the SDK's cost total for the whole conversation so far, not just this task's. */
  succeeded(task: RunningTask, result: string, runningTotalUsd: number): void {
    this.ledger.charge(task.sessionId, runningTotalUsd);
    this.sessions.updateSession(task.sessionId, { status: "done", lastResult: result, finishedAt: now() });
    this.history.record(task.sessionId, { task: task.instruction, outcome: "done", result });
  }

  addCost(task: RunningTask, runningTotalUsd: number): void {
    this.ledger.charge(task.sessionId, runningTotalUsd);
  }

  /** The failure is kept in history only when it isn't parked in todo (see TaskOutcomes). */
  failed(task: RunningTask, error: string): void {
    this.sessions.updateSession(task.sessionId, { status: "failed", lastError: error, finishedAt: now() });
  }

  keepFailure(task: RunningTask, error: string): void {
    this.history.record(task.sessionId, { task: task.instruction, outcome: "failed", result: error });
  }

  stopped(task: RunningTask): void {
    this.sessions.updateSession(task.sessionId, { status: "stopped", finishedAt: now() });
    this.history.record(task.sessionId, { task: task.instruction, outcome: "stopped", result: "Stopped by the user." });
  }
}

/** A new task clears the last one's error and activity. */
function startedPatch(task: RunningTask): SessionPatch {
  return { status: "running", task: task.instruction, startedAt: now(), lastError: undefined, lastActivity: undefined };
}
