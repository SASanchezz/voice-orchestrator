import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { RunningTask } from "../workers/running-task.js";
import type { TaskStream } from "../workers/task-stream.js";
import type { ContextMeter } from "./context-meter.js";

type Stream = Pick<TaskStream, "handle" | "finish">;

/** A worker's message stream that also measures how full the session's context gets. */
export class MeteredStream implements Stream {
  constructor(
    private stream: Stream,
    private meter: ContextMeter,
  ) {}

  handle(task: RunningTask, msg: SDKMessage): void {
    this.meter.record(task.sessionId, msg);
    this.stream.handle(task, msg);
  }

  finish(task: RunningTask, msg: SDKResultMessage): void {
    this.stream.finish(task, msg);
  }
}
