import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../agent/query-fn.js";
import { withHandoff } from "./handoff-prompt.js";
import type { RunningTask } from "./running-task.js";
import type { ToolCallGate } from "./tool-call-gate.js";
import type { WorkerOptions } from "./worker-options.js";

/** Ends every task's prompt, which also marks a saved conversation as one of this app's worker sessions. */
export const HEADLESS_NOTE =
  "\n\n(You are running headless and directed by voice. When finished, end with a 2-3 sentence plain-language summary of what you did and anything the user must decide.)";

/** Claude Code's default is to spawn subagents only when the user asks, so the ask has to come with every task. */
export const PARALLEL_WORK_NOTE =
  "\n\n(If the task is heavy and splits into independent parts, such as many files, areas or questions that don't depend on each other, you may run them as parallel subagents and merge their results. Keep small or tightly coupled tasks in this session.)";

/** Starts a task's Claude Code process; its permission prompts and questions go to the gate. */
export class TaskLauncher {
  constructor(
    private options: WorkerOptions,
    private gate: ToolCallGate,
    private query: QueryFn,
  ) {}

  launch(task: RunningTask, abort: AbortController): Query {
    return this.query({
      prompt: withHandoff(task.instruction, task.handoff) + PARALLEL_WORK_NOTE + HEADLESS_NOTE,
      options: this.options.forTask(task, abort, this.gate.forSession(task.sessionId)),
    });
  }
}
