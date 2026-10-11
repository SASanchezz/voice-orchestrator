import { z } from "zod";
import { PERMISSION_MODES } from "../../config/app-config.js";
import type { PermissionAnswers } from "../../permissions/permission-answers.js";
import type { PermissionPolicy } from "../../permissions/permission-policy.js";
import type { PermissionViews } from "../../permissions/permission-views.js";
import type { TurnContext } from "../conversation/turn-context.js";
import { defineTool, text, type OperatorTool } from "./tool-kit.js";

export function listPendingPermissions(views: PermissionViews): OperatorTool {
  return defineTool({
    name: "list_pending_permissions",
    description: "Worker permission requests waiting for an answer.",
    args: {},
    run: () => text(JSON.stringify(views.list())),
  });
}

export function setPermissionMode(policy: PermissionPolicy): OperatorTool {
  return defineTool({
    name: "set_permission_mode",
    description:
      "auto: workers skip permission prompts except for destructive commands. ask: every request goes to the user. Lasts until restart.",
    args: { mode: z.enum(PERMISSION_MODES) },
    run: ({ mode }) => text(policy.setMode(mode)),
  });
}

/** The user's actual words are checked, not the model's say-so: it can't approve a destructive action on its own. */
export function answerPermission(answers: PermissionAnswers, context: TurnContext): OperatorTool {
  return defineTool({
    name: "answer_permission",
    description: "Answer a worker's permission request.",
    args: { id: z.string(), decision: z.enum(["once", "always", "deny"]), denyReason: z.string().optional() },
    run: ({ id, decision, denyReason }) =>
      text(
        decision === "deny"
          ? answers.denyBySpeech(id, denyReason)
          : answers.allowBySpeech(id, decision, context.currentUtterance),
      ),
  });
}
