import { detectUsageLimit } from "../limits/usage-limit.js";
import type { LimitParking } from "./limit-parking.js";
import type { RunningTask } from "./running-task.js";
import type { TaskAnnouncer } from "./task-announcer.js";
import type { TaskRecorder } from "./task-recorder.js";

/** How a task's start and each way it can end are recorded, announced, or parked in todo. */
export class TaskOutcomes {
  constructor(
    private recorder: TaskRecorder,
    private announcer: TaskAnnouncer,
    private parking: LimitParking,
  ) {}

  started(task: RunningTask): void {
    this.recorder.started(task);
  }

  succeeded(task: RunningTask, result: string, costUsd: number): void {
    this.recorder.succeeded(task, result, costUsd);
    this.announcer.done(task, result);
    this.parking.accountWorks(task.account);
    this.announcer.finished(task);
  }

  /** Claude Code ended the task with an error result. */
  resultFailed(task: RunningTask, error: string, costUsd: number): void {
    this.recorder.addCost(task, costUsd);
    this.failed(task, error);
  }

  failed(task: RunningTask, error: string): void {
    this.recorder.failed(task, error);
    const limit = detectUsageLimit(error);
    if (limit) return this.parking.park(task, limit); // a limit hit never ran; it waits in todo
    this.recorder.keepFailure(task, error);
    this.announcer.failed(task, error);
  }

  stopped(task: RunningTask): void {
    this.recorder.stopped(task);
    this.announcer.stopped(task);
  }
}
