import type { PermissionMode } from "../config/app-config.js";
import { isReadOnlyCall, readsSecrets } from "../safety/call-safety.js";
import type { DestructiveRule } from "../safety/destructive-rules-file.js";
import type { BranchScopedRules } from "./branch-scoped-rules.js";
import { isFileEdit, type EditScope } from "./edit-scope.js";
import type { ToolCall } from "./permission-types.js";

/**
 * Which tool calls may run without asking you. Destructive ones and those that read a secret never may; file edits may
 * only inside the project's folder or a folder you allowed an edit in; ones that only read, search or list always may;
 * anything else may in auto mode and asks you in ask mode.
 */
export class PermissionPolicy {
  constructor(
    private mode: PermissionMode,
    private rules: BranchScopedRules,
    private edits: EditScope,
  ) {}

  get permissionMode(): PermissionMode {
    return this.mode;
  }

  /** Switch for the rest of this run; the mode at start comes from config. */
  setMode(mode: PermissionMode): string {
    this.mode = mode;
    return mode === "auto"
      ? "Auto mode: workers run everything without asking, except destructive commands, reading secrets and editing files outside the project."
      : "Ask mode: every permission request goes to the user, except read-only commands and edits inside the project.";
  }

  /** The destructive rule that applies to the call, if any; `toolUseId` lets a branch check from its hook count. */
  ruleFor(call: ToolCall, toolUseId?: string): DestructiveRule | undefined {
    return this.rules.ruleFor(call, toolUseId);
  }

  allowsWithoutAsking(sessionId: string, call: ToolCall, rule: DestructiveRule | undefined): boolean {
    if (rule || readsSecrets(call.toolName, call.input)) return false;
    if (isFileEdit(call.toolName)) return this.edits.allows(sessionId, call);
    return this.mode === "auto" || isReadOnlyCall(call.toolName, call.input);
  }

  /** You allowed the call: an edit outside the allowed folders opens its folder to the session. */
  rememberAllowed(sessionId: string, call: ToolCall): void {
    this.edits.allowFolderOf(sessionId, call);
  }
}
