import type { CanUseTool, Query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../agent/query-fn.js";
import type { PermissionBroker } from "../permissions/permission-broker.js";
import type { RunningTask } from "./running-task.js";
import type { WorkerOptions } from "./worker-options.js";

const HEADLESS_NOTE =
  "\n\n(You are running headless and directed by voice. When finished, end with a 2-3 sentence plain-language summary of what you did and anything the user must decide.)";

/** Starts a task's Claude Code process; its permission prompts go to the broker. */
export class TaskLauncher {
  constructor(
    private options: WorkerOptions,
    private broker: PermissionBroker,
    private query: QueryFn,
  ) {}

  launch(task: RunningTask, abort: AbortController): Query {
    const canUseTool: CanUseTool = (toolName, input, { suggestions, signal }) =>
      this.broker.request(task.sessionId, { toolName, input }, { suggestions, signal });
    return this.query({
      prompt: task.instruction + HEADLESS_NOTE,
      options: this.options.forTask(task, abort, canUseTool),
    });
  }
}
