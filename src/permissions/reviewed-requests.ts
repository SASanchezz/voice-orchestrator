import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { PermissionPolicy } from "./permission-policy.js";
import type { PermissionReview } from "./permission-review.js";
import type { PermissionRequests, RequestContext, ToolCall } from "./permission-types.js";

const ALLOWED: PermissionResult = { behavior: "allow" };
const STOPPED: PermissionResult = { behavior: "deny", message: "Run was stopped." };

/**
 * Lets the reviewer model pass a worker's call before it would ask you. Calls the policy passes on its own, and those
 * it never lets the reviewer pass, go straight on; the ones the reviewer doesn't pass ask you as before.
 */
export class ReviewedRequests implements PermissionRequests {
  constructor(
    private policy: PermissionPolicy,
    private review: PermissionReview,
    private asking: PermissionRequests,
  ) {}

  request(sessionId: string, call: ToolCall, context: RequestContext): Promise<PermissionResult> {
    const rule = this.policy.ruleFor(call, context.toolUseId);
    const passesAlone = this.policy.allowsWithoutAsking(sessionId, call, rule);
    if (passesAlone || !this.policy.allowsReview(rule)) return this.asking.request(sessionId, call, context);
    return this.reviewThenAsk(sessionId, call, context);
  }

  private async reviewThenAsk(sessionId: string, call: ToolCall, context: RequestContext): Promise<PermissionResult> {
    const rule = this.policy.ruleFor(call, context.toolUseId);
    if (await this.review.allows(sessionId, call, rule)) return ALLOWED;
    if (context.signal.aborted) return STOPPED;
    return this.asking.request(sessionId, call, context);
  }
}
