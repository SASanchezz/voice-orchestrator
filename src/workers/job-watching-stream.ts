import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { BackgroundJobs } from "./background-jobs.js";
import type { RunningTask } from "./running-task.js";
import type { TaskStream } from "./task-stream.js";

type Stream = Pick<TaskStream, "handle" | "finish">;

/** A worker's message stream that also keeps track of the background jobs it is waiting on. */
export class JobWatchingStream implements Stream {
  constructor(
    private stream: Stream,
    private jobs: Pick<BackgroundJobs, "follow">,
  ) {}

  handle(task: RunningTask, msg: SDKMessage): void {
    this.jobs.follow(task.sessionId, msg);
    this.stream.handle(task, msg);
  }

  finish(task: RunningTask, msg: SDKResultMessage): void {
    this.stream.finish(task, msg);
  }
}
