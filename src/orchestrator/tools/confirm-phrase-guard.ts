import type { HookCallback } from "@anthropic-ai/claude-agent-sdk";
import { utteranceConfirms } from "../../safety/confirm-phrase.js";
import type { DestructiveList } from "../../safety/destructive-list.js";
import { toolInput } from "../../safety/tool-calls.js";
import type { TurnContext } from "../conversation/turn-context.js";

/** The operator's own destructive tool calls (e.g. deleting a calendar event) run only if your words contain the confirm phrase. */
export class ConfirmPhraseGuard {
  constructor(
    private destructive: DestructiveList,
    private context: TurnContext,
  ) {}

  hook: HookCallback = async (input) => {
    if (input.hook_event_name !== "PreToolUse") return {};
    const rule = this.destructive.match(input.tool_name, toolInput(input.tool_input));
    if (!rule || utteranceConfirms(this.context.currentUtterance, rule.verb)) return {};
    const reason = `Destructive (${rule.verb}). Not run. Tell the user what will change and ask them to say "confirm ${rule.verb}".`;
    return {
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
    };
  };
}
