import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { questionInputSchema } from "./question-input.js";
import type { WaitingQuestions } from "./waiting-questions.js";

const UNREADABLE: PermissionResult = {
  behavior: "deny",
  message: "The orchestrator couldn't show these questions. Ask them in plain text in your reply instead.",
};

/**
 * Bridges a worker's questions to you. They wait in every permission mode, auto included:
 * only you can answer them, and the worker blocks until you do.
 */
export class QuestionBroker {
  private seq = 0;

  constructor(private waiting: WaitingQuestions) {}

  /** Called from a worker's canUseTool for AskUserQuestion; resolves with your answers added to its input. */
  ask(sessionId: string, input: Record<string, unknown>, signal: AbortSignal): Promise<PermissionResult> {
    const parsed = questionInputSchema.safeParse(input);
    if (!parsed.success) return Promise.resolve(UNREADABLE);
    const id = `q${++this.seq}`;
    const { questions } = parsed.data;
    return new Promise<PermissionResult>((resolve) => {
      this.waiting.open({ id, session: sessionId, questions, input, resolve }, signal);
    });
  }
}
