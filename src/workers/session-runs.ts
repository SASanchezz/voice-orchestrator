import type { SessionQueue } from "./session-queue.js";
import type { TaskRunner } from "./task-runner.js";
import type { WorkerDirectory } from "./worker-directory.js";

/** A session's worker while it works through its queue. */
interface ActiveRun {
  abort: AbortController;
  finished: Promise<void>;
}

/** The busy sessions, each working through its queue one task at a time. */
export class SessionRuns {
  private runs = new Map<string, ActiveRun>();

  constructor(
    private queue: SessionQueue,
    private directory: WorkerDirectory,
    private runner: TaskRunner,
  ) {}

  isRunning(sessionId: string): boolean {
    return this.runs.has(sessionId);
  }

  /** Starts the task, or queues it behind the running one. Returns its place in the queue; 0 when it started. */
  submit(sessionId: string, instruction: string): number {
    if (this.runs.has(sessionId)) return this.queue.add(sessionId, instruction);
    const abort = new AbortController();
    this.runs.set(sessionId, { abort, finished: this.loop(sessionId, instruction, abort) });
    return 0;
  }

  /** Clears the session's queue and stops its running task. */
  stop(sessionId: string): void {
    const run = this.runs.get(sessionId);
    if (!run) return;
    this.queue.clear(sessionId);
    run.abort.abort();
  }

  stopAll(): void {
    for (const sessionId of this.runs.keys()) this.stop(sessionId);
  }

  async stopAndWait(sessionId: string): Promise<void> {
    const run = this.runs.get(sessionId);
    if (!run) return;
    this.stop(sessionId);
    await run.finished;
  }

  /** Ends as soon as the queue is empty or a task didn't succeed; the session is free again in that same step. */
  private async loop(sessionId: string, first: string, abort: AbortController): Promise<void> {
    try {
      for (let next: string | undefined = first; next; next = this.queue.takeNext(sessionId))
        await this.runner.run(this.directory.newTask(sessionId, next), abort);
    } finally {
      this.runs.delete(sessionId);
    }
  }
}
