import type { Sessions } from "../registry/sessions.js";
import type { DestructiveRule } from "../safety/destructive-rules-file.js";
import { describeToolCall } from "../safety/tool-calls.js";
import { errorMessage } from "../shared/errors.js";
import type { ReviewVerdict } from "./command-reviewer.js";
import type { ReviewCommand, ToolCall } from "./permission-types.js";

/** A failed review sends the call to you, as any doubt does. */
const UNREVIEWED: ReviewVerdict = { allow: false, reason: "the review failed" };

/** Lets the reviewer model pass a worker's routine tool calls, and logs each one it passes. */
export class PermissionReview {
  constructor(
    private sessions: Sessions,
    private reviewCommand: ReviewCommand,
  ) {}

  async allows(sessionId: string, call: ToolCall, rule: DestructiveRule | undefined): Promise<boolean> {
    const project = this.sessions.session(sessionId).project;
    const verdict = await this.verdictFor(project, call, rule);
    if (verdict.allow) {
      console.log(
        `[permissions] reviewer allowed in ${project}: ${describeToolCall(call.toolName, call.input)} (${verdict.reason})`,
      );
    }
    return verdict.allow;
  }

  private async verdictFor(project: string, call: ToolCall, rule: DestructiveRule | undefined): Promise<ReviewVerdict> {
    try {
      return await this.reviewCommand(project, call, rule);
    } catch (e) {
      console.error(`[permissions] couldn't review the call: ${errorMessage(e)}`);
      return UNREVIEWED;
    }
  }
}
