// A worker session's chat as the page shows it: the lines you need to read stay in view, and the worker's
// intermediate steps between them fold into one block, with the permission requests they raised.
// Imports only types, so the page compiles it too.

import type { ChatMessageView } from "./protocol.js";
import { addApproval, addStep, allSteps, hasToolCall, lineCount, newStep, type Step } from "./step-tree.js";

/** A line shown as it is: the task, the worker's answer, a status, a question or a permission request. */
export interface ChatLineRow {
  kind: "line";
  key: string;
  message: ChatMessageView;
}

/** Steps in a row: tool calls, the worker's comments between them, and the requests they raised. */
export interface StepsRow {
  kind: "steps";
  key: string;
  steps: Step[];
}

export type SessionRow = ChatLineRow | StepsRow;

const SUMMARY_CHARS = 80;

export function sessionRows(messages: ChatMessageView[]): SessionRow[] {
  const stepIds = stepIdsOf(messages);
  const rows: SessionRow[] = [];
  for (const message of messages) {
    const last = rows.at(-1);
    const block = last?.kind === "steps" ? last : undefined;
    if (stepIds.has(message.id)) addToBlock(rows, block, message);
    else if (block && message.kind === "permission" && hasToolCall(block.steps)) addApproval(block.steps, message);
    else rows.push({ kind: "line", key: `line-${message.id}`, message });
  }
  return rows;
}

function addToBlock(rows: SessionRow[], block: StepsRow | undefined, message: ChatMessageView): void {
  if (block) addStep(block.steps, newStep(message));
  else rows.push({ kind: "steps", key: `steps-${message.id}`, steps: [newStep(message)] });
}

/**
 * Tool calls, a sub-agent's lines, and the worker's comments followed by a tool call before the run's next
 * status line ("Finished.", "Failed: …"). The comments after the last tool call are its answer, so they stay in view.
 */
function stepIdsOf(messages: ChatMessageView[]): Set<number> {
  const ids = new Set<number>();
  let toolFollows = false;
  for (const message of messages.toReversed()) {
    if (message.kind === "status") toolFollows = false;
    if (message.kind === "tool") toolFollows = true;
    const isComment = message.kind === "reply" && toolFollows;
    if (message.kind === "tool" || isComment || message.parentToolUseId) ids.add(message.id);
  }
  return ids;
}

/** "23 steps, last: Bash grep -rn …", or "1 step: Edit src/app.ts"; a sub-agent's steps count too. */
export function stepsSummary(steps: Step[]): string {
  const all = allSteps(steps);
  const latest = shortLine(all.at(-1)?.message.text ?? "");
  return all.length === 1 ? `1 step: ${latest}` : `${all.length} steps, last: ${latest}`;
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
  return before.kind === "line" || (after.kind === "steps" && lineCount(before.steps) === lineCount(after.steps));
}
