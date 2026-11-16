// What a session is about: the title a model wrote for it, else its first task, short enough for a tab or a list row.

import type { SessionView } from "./session-protocol.js";

const SHORT_TITLE_CHARS = 48;
const ELLIPSIS = "…";
const NEW_SESSION_TITLE = "new";
/** Markdown headings, quotes and list markers ("## ", "> ", "- ", "4. ", "1) ") wherever a voice task glued them in. */
const BLOCK_MARKERS = /(^|\s)(#{1,6}|>|[-*+]|\d+[.)])(?=\s)/g;
const INLINE_MARKERS = /[*_`]+/g;

/** The oldest remembered task, else the running one: what the session was opened for. */
export function sessionTopic(session: SessionView): string {
  return session.history[0]?.task ?? session.task ?? NEW_SESSION_TITLE;
}

export function shortSessionTitle(session: SessionView): string {
  if (session.title) return session.title;
  return shortened(withoutMarkdown(firstLine(sessionTopic(session))));
}

/** A task's first written line, with its spacing collapsed. */
export function firstLine(text: string): string {
  const line = text.split("\n").find((candidate) => candidate.trim() !== "") ?? "";
  return line.replace(/\s+/g, " ").trim();
}

function withoutMarkdown(line: string): string {
  const plain = line.replace(BLOCK_MARKERS, "$1").replace(INLINE_MARKERS, "");
  return plain.replace(/\s+/g, " ").trim();
}

/** Cut at the last whole word that fits, so a title never ends mid-word. */
function shortened(line: string): string {
  if (line.length <= SHORT_TITLE_CHARS) return line;
  const cut = line.slice(0, SHORT_TITLE_CHARS);
  const lastSpace = cut.lastIndexOf(" ");
  const wordEnd = lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
  return `${wordEnd.replace(/[\s,.;:–-]+$/, "")}${ELLIPSIS}`;
}
