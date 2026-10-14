// A worker session's chat as the page shows it: the lines you need to read stay in view, and the worker's
// intermediate steps between them fold into one block. Imports only types, so the page compiles it too.

import type { ChatMessageView } from "./protocol.js";

/** A line shown as it is: the task, the worker's answer, a status, a question or a permission request. */
export interface ChatLineRow {
  kind: "line";
  key: string;
  message: ChatMessageView;
}

/** Steps in a row: tool calls and the worker's comments between them. */
export interface StepsRow {
  kind: "steps";
  key: string;
  steps: ChatMessageView[];
}

export type SessionRow = ChatLineRow | StepsRow;

const SUMMARY_CHARS = 80;

export function sessionRows(messages: ChatMessageView[]): SessionRow[] {
  const steps = stepIds(messages);
  const rows: SessionRow[] = [];
  for (const message of messages) {
    const last = rows.at(-1);
    if (!steps.has(message.id)) rows.push({ kind: "line", key: `line-${message.id}`, message });
    else if (last?.kind === "steps") last.steps.push(message);
    else rows.push({ kind: "steps", key: `steps-${message.id}`, steps: [message] });
  }
  return rows;
}

/**
 * Tool calls, and the worker's comments followed by a tool call before the run's next status line
 * ("Finished.", "Failed: …"). The comments after the last tool call are its answer, so they stay in view.
 */
function stepIds(messages: ChatMessageView[]): Set<number> {
  const ids = new Set<number>();
  let toolFollows = false;
  for (const message of messages.toReversed()) {
    if (message.kind === "status") toolFollows = false;
    if (message.kind === "tool") toolFollows = true;
    if (message.kind === "tool" || (message.kind === "reply" && toolFollows)) ids.add(message.id);
  }
  return ids;
}

/** "23 steps, last: Bash grep -rn …", or "1 step: Edit src/app.ts". */
export function stepsSummary(steps: ChatMessageView[]): string {
  const latest = shortLine(steps.at(-1)?.text ?? "");
  return steps.length === 1 ? `1 step: ${latest}` : `${steps.length} steps, last: ${latest}`;
}

function shortLine(text: string): string {
  const firstLine = text.split("\n", 1)[0] ?? "";
  return firstLine.length > SUMMARY_CHARS ? `${firstLine.slice(0, SUMMARY_CHARS)}…` : firstLine;
}

/** How many leading rows are the same in both lists, so only the rest needs drawing again. */
export function unchangedRowCount(before: SessionRow[], after: SessionRow[]): number {
  const changed = after.findIndex((row, index) => !sameRow(before[index], row));
  return changed === -1 ? Math.min(before.length, after.length) : changed;
}

function sameRow(before: SessionRow | undefined, after: SessionRow): boolean {
  if (before?.key !== after.key) return false;
  return before.kind === "line" || (after.kind === "steps" && before.steps.length === after.steps.length);
}
