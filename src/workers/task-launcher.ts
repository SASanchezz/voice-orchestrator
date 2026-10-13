import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../agent/query-fn.js";
import type { RunningTask } from "./running-task.js";
import type { ToolCallGate } from "./tool-call-gate.js";
import type { WorkerOptions } from "./worker-options.js";

const HEADLESS_NOTE =
  "\n\n(You are running headless and directed by voice. When finished, end with a 2-3 sentence plain-language summary of what you did and anything the user must decide.)";

/** Starts a task's Claude Code process; its permission prompts and questions go to the gate. */
export class TaskLauncher {
  constructor(
    private options: WorkerOptions,
    private gate: ToolCallGate,
    private query: QueryFn,
  ) {}

  launch(task: RunningTask, abort: AbortController): Query {
    return this.query({
      prompt: task.instruction + HEADLESS_NOTE,
      options: this.options.forTask(task, abort, this.gate.forSession(task.sessionId)),
    });
  }
}
