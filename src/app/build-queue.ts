import { QueueControl } from "../workers/queue-control.js";
import { QueuedTasks } from "../workers/queued-tasks.js";
import type { SessionQueue } from "../workers/session-queue.js";
import type { SessionRuns } from "../workers/session-runs.js";
import type { WorkerDirectory } from "../workers/worker-directory.js";

export interface QueueParts {
  /** Sessions' queued instructions, to list, remove, edit or move one up. */
  queuedTasks: QueuedTasks;
  /** Resuming or clearing a paused queue. */
  queueControl: QueueControl;
}

/** Changing a session's queue: its tasks one by one, or the whole queue once paused. */
export function queueParts(queue: SessionQueue, runs: SessionRuns, directory: WorkerDirectory): QueueParts {
  return { queuedTasks: new QueuedTasks(queue, directory), queueControl: new QueueControl(queue, runs, directory) };
}
