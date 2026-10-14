import type { SDKMessage, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { Sessions } from "../registry/sessions.js";
import type { RunningTask } from "./running-task.js";
import type { TaskOutcomes } from "./task-outcomes.js";
import type { WorkerActivity } from "./worker-activity.js";

/** What a running worker's messages change: its conversation id, its chat and activity; and at the end its outcome. */
export class TaskStream {
  constructor(
    private sessions: Sessions,
    private activity: WorkerActivity,
    private outcomes: TaskOutcomes,
  ) {}

  handle(task: RunningTask, msg: SDKMessage): void {
    this.rememberConversation(task.sessionId, msg);
    if (msg.type === "assistant")
      this.activity.record(task.sessionId, msg.message.content, msg.parent_tool_use_id ?? undefined);
  }

  /** The next task resumes this conversation. */
  private rememberConversation(sessionId: string, msg: SDKMessage): void {
    if ("session_id" in msg && msg.session_id && msg.session_id !== this.sessions.session(sessionId).claudeSessionId)
      this.sessions.updateSession(sessionId, { claudeSessionId: msg.session_id });
  }

  /**
   * The task's outcome, from the run's last result. A worker waiting on background helpers ends a turn
   * (a result) and goes on when they report back, so only the result the run ends with counts. Its cost
   * is the run's running total.
   */
  finish(task: RunningTask, msg: SDKResultMessage): void {
    const costUsd = msg.total_cost_usd ?? 0;
    if (msg.subtype === "success" && !msg.is_error) return this.outcomes.succeeded(task, msg.result, costUsd);
    this.outcomes.resultFailed(task, msg.subtype === "success" ? msg.result : msg.subtype, costUsd);
  }
}

/** A result that ended the task with an error; Claude Code throws that same error right after. */
export function isFailedResult(msg: SDKMessage): boolean {
  return msg.type === "result" && !(msg.subtype === "success" && !msg.is_error);
}
