import type { CanUseTool } from "@anthropic-ai/claude-agent-sdk";
import type { PermissionBroker } from "../permissions/permission-broker.js";
import type { QuestionBroker } from "../questions/question-broker.js";
import { QUESTION_TOOL } from "../questions/question-input.js";

/** Where a worker's tool call waits for you: its questions go to the question dialog, everything else to permissions. */
export class ToolCallGate {
  constructor(
    private permissions: PermissionBroker,
    private questions: QuestionBroker,
  ) {}

  forSession(sessionId: string): CanUseTool {
    return (toolName, input, { suggestions, signal }) =>
      toolName === QUESTION_TOOL
        ? this.questions.ask(sessionId, input, signal)
        : this.permissions.request(sessionId, { toolName, input }, { suggestions, signal });
  }
}
