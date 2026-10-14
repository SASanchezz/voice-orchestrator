import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import { describeToolCall } from "../safety/tool-calls.js";
import type { PermissionExplanations } from "./permission-explanations.js";
import type { PermissionPolicy } from "./permission-policy.js";
import type { RequestContext, ToolCall } from "./permission-types.js";
import type { WaitingRequests } from "./waiting-requests.js";

/**
 * Bridges worker permission prompts to voice.
 * Workers block in canUseTool until you answer; nothing is ever auto-approved on timeout.
 */
export class PermissionBroker {
  private seq = 0;

  constructor(
    private policy: PermissionPolicy,
    private waiting: WaitingRequests,
    private explanations?: PermissionExplanations,
  ) {}

  /** Called from a worker's canUseTool. Resolves at once when the policy allows the call, otherwise when you answer. */
  request(sessionId: string, call: ToolCall, context: RequestContext): Promise<PermissionResult> {
    const destructive = this.policy.ruleFor(call);
    if (this.policy.allowsWithoutAsking(call, destructive)) return Promise.resolve({ behavior: "allow" });
    const id = `p${++this.seq}`;
    const explaining = Boolean(this.explanations);
    const { suggestions, signal } = context;
    return new Promise<PermissionResult>((resolve) => {
      this.waiting.open({ id, session: sessionId, call, destructive, suggestions, explaining, resolve }, signal);
      if (explaining) void this.explanations?.attach(id, describeToolCall(call.toolName, call.input));
      this.waiting.announce(id);
    });
  }
}
