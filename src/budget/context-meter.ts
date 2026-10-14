import { z } from "zod";
import type { SessionPatch } from "../registry/registry-schema.js";
import type { Sessions } from "../registry/sessions.js";
import {
  type BudgetLevel,
  type ContextThresholds,
  contextLevel,
  contextPercentOf,
  isHigherLevel,
} from "./budget-levels.js";
import type { ContextAlerts } from "./context-alerts.js";

/** A main-loop call (not a sub-agent's, which has its own context) and the tokens it read. */
const mainCallSchema = z.object({
  type: z.literal("assistant"),
  parent_tool_use_id: z.null(),
  message: z.object({
    usage: z.object({
      input_tokens: z.number(),
      cache_read_input_tokens: z.number().nullish(),
      cache_creation_input_tokens: z.number().nullish(),
    }),
  }),
});
type CallUsage = z.infer<typeof mainCallSchema>["message"]["usage"];

/** A result, with each model's context window. */
const resultSchema = z.object({
  type: z.literal("result"),
  modelUsage: z.record(z.string(), z.object({ contextWindow: z.number() })),
});

/**
 * How full each session's context is: what the worker's latest main-loop call read, against the window its result
 * reports. Kept in the session, so a restart keeps it; each level is alerted once on the way up.
 */
export class ContextMeter {
  constructor(
    private sessions: Sessions,
    private thresholds: ContextThresholds,
    private alerts: ContextAlerts,
  ) {}

  /** Any message from the worker; those without token counts are ignored. */
  record(sessionId: string, msg: unknown): void {
    const patch = contextPatch(msg);
    if (!patch || this.isKnown(sessionId, patch)) return;
    const before = this.levelOf(sessionId);
    this.sessions.updateSession(sessionId, patch);
    const after = this.levelOf(sessionId);
    if (after !== "ok" && isHigherLevel(after, before))
      this.alerts.raised(sessionId, after, contextPercentOf(this.sessions.session(sessionId)));
  }

  private isKnown(sessionId: string, patch: SessionPatch): boolean {
    const { contextTokens, contextWindow } = this.sessions.session(sessionId);
    return (
      (patch.contextTokens ?? contextTokens) === contextTokens &&
      (patch.contextWindow ?? contextWindow) === contextWindow
    );
  }

  private levelOf(sessionId: string): BudgetLevel {
    return contextLevel(contextPercentOf(this.sessions.session(sessionId)), this.thresholds);
  }
}

function contextPatch(msg: unknown): SessionPatch | undefined {
  const call = mainCallSchema.safeParse(msg);
  if (call.success) return { contextTokens: contextTokensOf(call.data.message.usage) };
  const result = resultSchema.safeParse(msg);
  const windows = result.success ? Object.values(result.data.modelUsage).map((usage) => usage.contextWindow) : [];
  return windows.length ? { contextWindow: Math.max(...windows) } : undefined;
}

/** Everything the call read: new input plus what came from the prompt cache or went into it. */
function contextTokensOf(usage: CallUsage): number {
  return usage.input_tokens + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0);
}
