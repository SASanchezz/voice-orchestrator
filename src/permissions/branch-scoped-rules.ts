import type { BranchProtection } from "../safety/branch-protection.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import type { DestructiveRule } from "../safety/destructive-rules-file.js";
import { asText } from "../shared/text.js";
import type { ToolCall } from "./permission-types.js";

/** Enough to cover every call between a worker's PreToolUse hook and its canUseTool; older ones are dropped. */
const MAX_EXEMPT_CALLS = 500;

/**
 * The destructive rule a worker's tool call matches, where rules scoped to protected branches are left out when the
 * call's git commands run on an unprotected worktree branch. Only the PreToolUse hook knows the folder a call runs in,
 * so it checks there and the call is remembered by its tool use id for canUseTool, which runs next.
 */
export class BranchScopedRules {
  private exemptCalls = new Set<string>();

  constructor(
    private destructive: DestructiveList,
    private protection: BranchProtection,
  ) {}

  /** Exempts the call from its branch-scoped rules when it matches only those and runs on an unprotected branch. */
  async checkBranch(call: ToolCall, folder: string, toolUseId: string): Promise<void> {
    const rules = this.destructive.matchAll(call.toolName, call.input);
    const onlyBranchScoped = call.toolName === "Bash" && rules.length > 0 && rules.every(isBranchScoped);
    if (!onlyBranchScoped) return;
    if (await this.protection.isProtected(asText(call.input.command ?? ""), folder)) return;
    this.remember(toolUseId);
  }

  /** The first rule that applies; without a tool use id from a checked call, every matching rule does. */
  ruleFor(call: ToolCall, toolUseId?: string): DestructiveRule | undefined {
    const rules = this.destructive.matchAll(call.toolName, call.input);
    const exempt = toolUseId !== undefined && this.exemptCalls.has(toolUseId);
    return exempt ? rules.find((rule) => !isBranchScoped(rule)) : rules[0];
  }

  private remember(toolUseId: string): void {
    this.exemptCalls.add(toolUseId);
    if (this.exemptCalls.size <= MAX_EXEMPT_CALLS) return;
    const [oldest] = this.exemptCalls;
    this.exemptCalls.delete(oldest);
  }
}

function isBranchScoped(rule: DestructiveRule): boolean {
  return rule.scope === "protectedBranch";
}
