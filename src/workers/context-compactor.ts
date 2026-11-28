import type { Query, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { QueryFn } from "../agent/query-fn.js";
import type { SpendLedger } from "../budget/spend-ledger.js";
import type { SessionState } from "../registry/registry-schema.js";
import type { WorkerOptions } from "./worker-options.js";

const COMPACT_COMMAND = "/compact";

/** The line Claude Code writes where it cut the conversation down to a summary, with its size before and after. */
const boundarySchema = z.object({
  type: z.literal("system"),
  subtype: z.literal("compact_boundary"),
  compact_metadata: z.object({ pre_tokens: z.number(), post_tokens: z.number().optional() }),
});

/** What compacting left: the conversation to resume, and its size in tokens; `tokensAfter` only if Claude Code says. */
export interface ContextShrink {
  conversationId: string;
  tokensBefore: number;
  tokensAfter?: number;
}

/** Claude Code's /compact, told what the summary should keep when there is something. */
export function compactCommand(focus = ""): string {
  return `${COMPACT_COMMAND} ${focus}`.trim();
}

/**
 * Shrinks a session's conversation in place with Claude Code's /compact, on its own account and model: the older turns
 * become a summary, and the session's next task resumes from it. The cost is the session's.
 */
export class ContextCompactor {
  constructor(
    private options: Pick<WorkerOptions, "forProject">,
    private query: QueryFn,
    private ledger: Pick<SpendLedger, "charge">,
  ) {}

  async compact(session: SessionState, command: string, abort: AbortController): Promise<ContextShrink> {
    const project = this.options.forProject(session.project);
    const run = this.query({
      prompt: command,
      options: {
        ...project,
        model: session.model ?? project.model,
        resume: session.claudeSessionId,
        abortController: abort,
        permissionMode: "dontAsk",
        allowedTools: [],
      },
    });
    return this.shrinkOf(session.id, run);
  }

  private async shrinkOf(sessionId: string, run: Query): Promise<ContextShrink> {
    let boundary: z.infer<typeof boundarySchema> | undefined;
    for await (const msg of run) {
      const parsed = boundarySchema.safeParse(msg);
      if (parsed.success) boundary = parsed.data;
      if (msg.type === "result") return this.finish(sessionId, msg, boundary);
    }
    throw new Error("Couldn't compact the context: the worker ended without a result.");
  }

  private finish(
    sessionId: string,
    result: SDKResultMessage,
    boundary: z.infer<typeof boundarySchema> | undefined,
  ): ContextShrink {
    this.ledger.charge(sessionId, result.total_cost_usd);
    if (result.subtype !== "success" || result.is_error)
      throw new Error(`Couldn't compact the context (${result.subtype}).`);
    if (!boundary) throw new Error(`Couldn't compact the context: ${result.result.trim() || "nothing was cut"}.`);
    const { pre_tokens: tokensBefore, post_tokens: tokensAfter } = boundary.compact_metadata;
    return { conversationId: result.session_id, tokensBefore, tokensAfter };
  }
}
