import type { TaskEndEvent } from "../../events/app-events.js";

const MAX_GIST_WORDS = 8;
const FALLBACK_GIST = "its task";
/** Openers that carry no meaning when read back: "please", "can you", "go ahead and"... */
const FILLER =
  /^(please|pls|ok(ay)?|so|now|hey|can you|could you|would you|will you|i want you to|i'd like you to|let's|lets|go ahead and|try to)([\s,]+|$)/i;
const SENTENCE_END = /[.!?;](\s|$)/;
const TRAILING_PUNCTUATION = /[\s.,:;!?-]+$/;

/**
 * A few words saying what a task was about, short enough to speak in a notification.
 * Cut from the task text itself, so it costs no model call and no delay.
 */
export function spokenGist(task: string): string {
  const firstLine = task.trim().split("\n")[0];
  const firstSentence = firstLine.split(SENTENCE_END)[0];
  const words = withoutFiller(firstSentence).split(/\s+/).filter(Boolean).slice(0, MAX_GIST_WORDS);
  return words.join(" ").replace(TRAILING_PUNCTUATION, "") || FALLBACK_GIST;
}

/** How an ended task is announced, aloud and in the page's pop-up: "acme-web session 3 done: add a countdown". */
export function taskHeadline(e: TaskEndEvent): string {
  const outcome = e.kind === "task_done" ? "done" : "failed";
  return `${e.project} session ${e.sessionNumber} ${outcome}: ${spokenGist(e.task)}`;
}

function withoutFiller(text: string): string {
  let rest = text.trim();
  while (FILLER.test(rest)) rest = rest.replace(FILLER, "");
  return rest;
}
