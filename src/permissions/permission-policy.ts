import type { PermissionMode } from "../config/app-config.js";
import { isReadOnlyCall, readsSecrets } from "../safety/call-safety.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import type { DestructiveRule } from "../safety/destructive-rules-file.js";
import type { ToolCall } from "./permission-types.js";

/**
 * Which tool calls may run without asking you. Destructive ones and those that read a secret never may; ones that only
 * read, search or list always may; anything else may in auto mode and asks you in ask mode.
 */
export class PermissionPolicy {
  constructor(
    private mode: PermissionMode,
    private destructive: DestructiveList,
  ) {}

  get permissionMode(): PermissionMode {
    return this.mode;
  }

  /** Switch for the rest of this run; the mode at start comes from config. */
  setMode(mode: PermissionMode): string {
    this.mode = mode;
    return mode === "auto"
      ? "Auto mode: workers run everything without asking, except destructive commands and reading secrets."
      : "Ask mode: every permission request goes to the user, except read-only commands.";
  }

  /** The destructive rule the call matches, if any. */
  ruleFor(call: ToolCall): DestructiveRule | undefined {
    return this.destructive.match(call.toolName, call.input);
  }

  allowsWithoutAsking(call: ToolCall, rule: DestructiveRule | undefined): boolean {
    if (rule || readsSecrets(call.toolName, call.input)) return false;
    return this.mode === "auto" || isReadOnlyCall(call.toolName, call.input);
  }
}
