import type { Query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../agent/query-fn.js";
import type { SpendLedger } from "../budget/spend-ledger.js";
import type { SessionState } from "../registry/registry-schema.js";
import { HANDOFF_REQUEST } from "./handoff-prompt.js";
import type { WorkerOptions } from "./worker-options.js";

const MAX_TURNS = 2;

/** Writes a session's handoff summary in a fork of its own conversation, on its own account; the cost is the session's. */
export class HandoffWriter {
  constructor(
    private options: WorkerOptions,
    private query: QueryFn,
    private ledger: SpendLedger,
  ) {}

  async write(session: SessionState): Promise<string> {
    const run = this.query({
      prompt: HANDOFF_REQUEST,
      options: {
        ...this.options.forProject(session.project),
        resume: session.claudeSessionId,
        forkSession: true,
        permissionMode: "dontAsk",
        allowedTools: [],
        maxTurns: MAX_TURNS,
      },
    });
    return this.summaryOf(session.id, run);
  }

  private async summaryOf(sessionId: string, run: Query): Promise<string> {
    for await (const msg of run) {
      if (msg.type !== "result") continue;
      this.ledger.chargeFork(sessionId, msg.total_cost_usd);
      if (msg.subtype === "success" && !msg.is_error && msg.result.trim()) return msg.result.trim();
      throw new Error(`Couldn't write the handoff summary (${msg.subtype}).`);
    }
    throw new Error("Couldn't write the handoff summary: the worker ended without one.");
  }
}
