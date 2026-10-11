import { z } from "zod";
import { utteranceConfirms } from "../../safety/confirm-phrase.js";
import type { DestructiveList } from "../../safety/destructive-list.js";
import type { TurnContext } from "../conversation/turn-context.js";
import { defineTool, text, type OperatorTool } from "./tool-kit.js";

const CONFIRM_EDIT_FIRST = `Not done. Ask the user to say "confirm edit".`;

export function destructiveRules(destructive: DestructiveList): OperatorTool {
  return defineTool({
    name: "destructive_rules",
    description: "List the destructive-action rules.",
    args: {},
    run: () =>
      text(
        destructive
          .list()
          .map((r) => `${r.verb}: /${r.pattern}/`)
          .join("\n"),
      ),
  });
}

export function destructiveAdd(destructive: DestructiveList, context: TurnContext): OperatorTool {
  return defineTool({
    name: "destructive_add",
    description: "Add a destructive rule. Needs the user to say 'confirm edit'.",
    args: {
      pattern: z.string().describe("Case-insensitive regex, e.g. \\bterraform\\s+apply\\b"),
      verb: z.string().describe("Word for 'confirm <verb>'"),
    },
    run: ({ pattern, verb }) => {
      if (!utteranceConfirms(context.currentUtterance, "edit")) return text(CONFIRM_EDIT_FIRST);
      destructive.add({ pattern, verb: verb.toLowerCase() });
      return text(`Added: say "confirm ${verb}" for /${pattern}/.`);
    },
  });
}

export function destructiveRemove(destructive: DestructiveList, context: TurnContext): OperatorTool {
  return defineTool({
    name: "destructive_remove",
    description: "Remove a destructive rule by its exact pattern. Needs 'confirm edit'.",
    args: { pattern: z.string() },
    run: ({ pattern }) => {
      if (!utteranceConfirms(context.currentUtterance, "edit")) return text(CONFIRM_EDIT_FIRST);
      return text(destructive.remove(pattern) ? `Removed /${pattern}/.` : `No rule with that pattern.`);
    },
  });
}
