import type { PermissionMode } from "../config/app-config.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import type { DestructiveRule } from "../safety/destructive-rules-file.js";
import type { ToolCall } from "./permission-types.js";

/** Which tool calls may run without asking you: in auto mode everything but destructive ones; in ask mode nothing. */
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
      ? "Auto mode: workers run everything without asking, except destructive commands."
      : "Ask mode: every permission request goes to the user.";
  }

  /** The destructive rule the call matches, if any. */
  ruleFor(call: ToolCall): DestructiveRule | undefined {
    return this.destructive.match(call.toolName, call.input);
  }

  allowsWithoutAsking(rule: DestructiveRule | undefined): boolean {
    return this.mode === "auto" && !rule;
  }
}
