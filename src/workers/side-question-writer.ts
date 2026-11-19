import type { Options, Query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../agent/query-fn.js";
import type { SpendLedger } from "../budget/spend-ledger.js";
import type { RunningTask } from "./running-task.js";
import type { WorkerOptions } from "./worker-options.js";

const MAX_TURNS = 1;

/** Like Claude Code's own /btw: the worker answers from what it already knows, while its task goes on. */
const SIDE_QUESTION_NOTE =
  "(This is a quick side question from the user, asked with /btw while your main work may still be running. " +
  "You have no tools: answer in one short reply from the conversation so far. " +
  "Don't change plans or start work because of it; your main work continues separately.)";

/**
 * Answers a /btw question in a throwaway fork of the session's conversation: the session keeps no trace of it,
 * and the cost is the session's.
 */
export class SideQuestionWriter {
  constructor(
    private options: WorkerOptions,
    private query: QueryFn,
    private ledger: SpendLedger,
  ) {}

  async answer(task: RunningTask): Promise<string> {
    const run = this.query({ prompt: `${SIDE_QUESTION_NOTE}\n\n${task.instruction}`, options: this.optionsFor(task) });
    return this.answerOf(task.sessionId, run);
  }

  private optionsFor(task: RunningTask): Options {
    return {
      ...this.options.forProject(task.project),
      model: task.model,
      resume: task.resume,
      forkSession: task.resume !== undefined,
      persistSession: false,
      tools: [],
      maxTurns: MAX_TURNS,
    };
  }

  private async answerOf(sessionId: string, run: Query): Promise<string> {
    for await (const msg of run) {
      if (msg.type !== "result") continue;
      this.ledger.chargeFork(sessionId, msg.total_cost_usd);
      if (msg.subtype === "success" && !msg.is_error && msg.result.trim()) return msg.result.trim();
      throw new Error(`Couldn't answer the side question (${msg.subtype}).`);
    }
    throw new Error("Couldn't answer the side question: the worker ended without an answer.");
  }
}
