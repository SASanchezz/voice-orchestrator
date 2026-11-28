import type { QueuedTask } from "./queued-task.js";
import type { SessionQueue } from "./session-queue.js";
import type { TaskStarter } from "./task-starter.js";
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
    private starter: Pick<TaskStarter, "run">,
  ) {}

  isRunning(sessionId: string): boolean {
    return this.runs.has(sessionId);
  }

  /** Starts the task, or queues it behind the running one. Returns its place in the queue; 0 when it started. */
  submit(sessionId: string, task: QueuedTask): number {
    if (this.runs.has(sessionId)) return this.queue.add(sessionId, task);
    this.occupy(sessionId, (abort) => this.starter.run(sessionId, task, abort));
    return 0;
  }

  /** The paused queue goes on after the running task, or from its #1 once the session is idle or its stop is done. */
  async resume(sessionId: string): Promise<void> {
    const run = this.runs.get(sessionId);
    if (run?.abort.signal.aborted) await run.finished;
    this.queue.unpause(sessionId);
    if (this.runs.has(sessionId)) return;
    const first = this.queue.takeFirst(sessionId);
    if (first) this.occupy(sessionId, (abort) => this.starter.run(sessionId, first, abort));
  }

  /** Work needing the idle session's conversation to itself, like compacting it; tasks sent meanwhile queue behind it. */
  runAlone<T>(sessionId: string, work: (abort: AbortController) => Promise<T>): Promise<T> {
    if (this.runs.has(sessionId)) throw new Error(`${this.directory.labelOf(sessionId)} is working.`);
    return new Promise<T>((resolve, reject) => this.occupy(sessionId, (abort) => work(abort).then(resolve, reject)));
  }

  /** Stops the session's running task; what it had queued waits until you resume it. */
  stop(sessionId: string): void {
    const run = this.runs.get(sessionId);
    if (!run) return;
    this.queue.pause(sessionId);
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

  private occupy(sessionId: string, first: (abort: AbortController) => Promise<void>): void {
    const abort = new AbortController();
    this.runs.set(sessionId, { abort, finished: this.loop(sessionId, first(abort), abort) });
  }

  /**
   * Ends as soon as the queue is empty, paused, or a task didn't succeed; what is left then waits, paused. The session
   * is free again in that same step.
   */
  private async loop(sessionId: string, first: Promise<void>, abort: AbortController): Promise<void> {
    try {
      await first;
      for (let next = this.queue.takeNext(sessionId); next; next = this.queue.takeNext(sessionId))
        await this.starter.run(sessionId, next, abort);
    } finally {
      this.queue.pause(sessionId);
      this.runs.delete(sessionId);
    }
  }
}
