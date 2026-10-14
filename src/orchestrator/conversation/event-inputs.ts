import {
  sessionLinkOf,
  type AppEvent,
  type PermissionEvent,
  type ContextFullEvent,
  type QuestionEvent,
  type TaskEndEvent,
} from "../../events/app-events.js";
import { usageLimitMessage } from "../../limits/usage-limit.js";
import { taskHeadline } from "./gist.js";
import type { Input } from "./inputs.js";
import type { EventVoices } from "./event-voices.js";

/**
 * What an app event becomes for the operator: a notification turn, or a notice said once
 * for a usage limit, and for a worker's questions, which you answer on screen.
 */
export function inputFor(e: AppEvent, voices: Pick<EventVoices, "voiceOf">): Input {
  if (e.kind === "usage_limit") return { kind: "notice", text: describeEvent(e), spoken: usageLimitMessage(e) };
  if (e.kind === "context_full") return { kind: "notice", text: describeEvent(e), spoken: contextAnnouncement(e) };
  if (e.kind === "question")
    return { kind: "notice", text: describeEvent(e), spoken: questionAnnouncement(e), voice: voices.voiceOf(e) };
  const ended = taskEndOf(e);
  return {
    kind: "event",
    text: describeEvent(e),
    permissionId: e.kind === "permission" ? e.id : undefined,
    session: e.kind === "permission" ? undefined : sessionLinkOf(e),
    urgent: e.kind !== "task_done",
    announcement: ended && taskHeadline(ended),
    voice: ended && voices.voiceOf(ended),
  };
}

function describeEvent(e: AppEvent): string {
  if (e.kind === "task_done")
    return `[EVENT] ${e.label} finished its task. Worker's closing note: ${e.result}\nTask (session ${e.sessionNumber}): ${e.task}`;
  if (e.kind === "task_failed")
    return `[EVENT] ${e.label} failed: ${e.error}\nTask (session ${e.sessionNumber}): ${e.task}`;
  if (e.kind === "permission") return describePermission(e);
  if (e.kind === "question") return describeQuestions(e);
  if (e.kind === "context_full") return describeContext(e);
  return `[NOTICE] ${usageLimitMessage(e)}. Later limit failures on this account are saved to todo without notice.`;
}

function describePermission(e: PermissionEvent): string {
  const reminder = e.reminder ? "(reminder, still waiting) " : "";
  const destructive = e.destructiveVerb ? ` -- DESTRUCTIVE: user must say "confirm ${e.destructiveVerb}".` : "";
  return `[PERMISSION ${e.id}] ${reminder}${e.label} wants approval for ${e.description}${destructive}`;
}

function describeQuestions(e: QuestionEvent): string {
  const asked = e.questions.map(({ question }) => `"${question}"`).join(" ");
  return `[NOTICE] ${e.label} asks: ${asked} The user answers in the web UI or its pop-up; you can't answer for them.`;
}

function describeContext(e: ContextFullEvent): string {
  return `[NOTICE] ${e.label}'s context is ${e.percent}% full, so each further turn there costs much more. The user can hand it off to a new session with a summary from the web UI.`;
}

function contextAnnouncement(e: ContextFullEvent): string {
  return `${e.label} is at ${e.percent} percent of its context; consider handing it off to a new session`;
}

/** Only a short line is said; the questions and their options are shown on screen. */
function questionAnnouncement(e: QuestionEvent): string {
  return e.questions.length === 1 ? `${e.label} has a question` : `${e.label} has some questions`;
}

/**
 * A task's end has a short announcement, e.g. "acme-web session 2 done: …", said if the model's reply has nothing
 * to say aloud in time, and a voice its pop-up can silence.
 */
function taskEndOf(e: AppEvent): TaskEndEvent | undefined {
  return e.kind === "task_done" || e.kind === "task_failed" ? e : undefined;
}
