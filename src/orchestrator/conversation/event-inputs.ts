import { sessionLinkOf, type AppEvent, type PermissionEvent } from "../../events/app-events.js";
import { usageLimitMessage } from "../../limits/usage-limit.js";
import { taskHeadline } from "./gist.js";
import type { Input } from "./inputs.js";

/** What an app event becomes for the operator: a notification turn, or for a usage limit a notice said once. */
export function inputFor(e: AppEvent): Input {
  if (e.kind === "usage_limit") return { kind: "notice", text: describeEvent(e), spoken: usageLimitMessage(e) };
  return {
    kind: "event",
    text: describeEvent(e),
    permissionId: e.kind === "permission" ? e.id : undefined,
    session: e.kind === "permission" ? undefined : sessionLinkOf(e),
    urgent: e.kind !== "task_done",
    announcement: announcementFor(e),
  };
}

function describeEvent(e: AppEvent): string {
  if (e.kind === "task_done")
    return `[EVENT] ${e.label} finished its task. Worker's closing note: ${e.result}\nTask (session ${e.sessionNumber}): ${e.task}`;
  if (e.kind === "task_failed")
    return `[EVENT] ${e.label} failed: ${e.error}\nTask (session ${e.sessionNumber}): ${e.task}`;
  if (e.kind === "permission") return describePermission(e);
  return `[NOTICE] ${usageLimitMessage(e)}. Later limit failures on this account are saved to todo without notice.`;
}

function describePermission(e: PermissionEvent): string {
  const reminder = e.reminder ? "(reminder, still waiting) " : "";
  const destructive = e.destructiveVerb ? ` -- DESTRUCTIVE: user must say "confirm ${e.destructiveVerb}".` : "";
  return `[PERMISSION ${e.id}] ${reminder}${e.label} wants approval for ${e.description}${destructive}`;
}

/** What's said when a task ends if the model's reply has nothing to say aloud in time, e.g. "acme-web session 2 done: …". */
function announcementFor(e: AppEvent): string | undefined {
  return e.kind === "task_done" || e.kind === "task_failed" ? taskHeadline(e) : undefined;
}
