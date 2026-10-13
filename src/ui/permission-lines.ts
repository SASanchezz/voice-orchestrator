// The assistant chat's short lines for clicked permission answers, and runs of them folded into one.
// No runtime imports, so the page bundles it and Node tests it.

import type { FeedEntryView } from "./protocol.js";

/** A permission answer as the chat shows it: "Allowed once: database play, Bash" and a short look at the command. */
export interface PermissionAnswer {
  outcome: string;
  allowed: boolean;
  label: string;
  tool: string;
  command: string;
}

/** "Allowed once: <label>: <tool>: <command>" or "Denied <label>: <tool>: <command>", as the server words them. */
const ANSWER_TEXT = /^(Allowed once|Allowed permanently|Denied):? (.+?): ([\w.-]+): ([\s\S]*)$/;
/** The `cd "<project folder>" &&` that starts most commands says nothing the label doesn't. */
const LEADING_CD = /^cd\s+("[^"]*"|'[^']*'|\S+)\s*&&\s*/;
const PREVIEW_CHARS = 60;

export function permissionAnswerOf(entry: FeedEntryView): PermissionAnswer | undefined {
  const match = entry.kind === "action" ? ANSWER_TEXT.exec(entry.text) : null;
  if (!match) return undefined;
  const [, outcome, label, tool, command] = match;
  return { outcome, allowed: outcome !== "Denied", label, tool, command };
}

/** The command on one short line, cut off with … when it is long. */
export function commandPreview(command: string): string {
  const oneLine = command.replace(LEADING_CD, "").replace(/\s+/g, " ").trim();
  return oneLine.length > PREVIEW_CHARS ? `${oneLine.slice(0, PREVIEW_CHARS)}…` : oneLine;
}

/** The chat's rows: single entries, and permission answers in a row about the same label folded into one. */
export function chatRows(entries: FeedEntryView[]): FeedEntryView[][] {
  const rows: FeedEntryView[][] = [];
  for (const entry of entries) {
    const row = rows.at(-1);
    if (row && joinsPermissionRow(row.at(-1), entry)) row.push(entry);
    else rows.push([entry]);
  }
  return rows;
}

/** Whether `entry` folds into the row ending with `previous`: both permission answers about the same label. */
export function joinsPermissionRow(previous: FeedEntryView | undefined, entry: FeedEntryView): boolean {
  const before = previous && permissionAnswerOf(previous);
  return !!before && before.label === permissionAnswerOf(entry)?.label;
}

/** "4 permissions allowed in database play", or "3 permissions in dbadmin: 2 allowed, 1 denied". */
export function permissionRowSummary(answers: PermissionAnswer[]): string {
  const allowed = answers.filter((answer) => answer.allowed).length;
  const denied = answers.length - allowed;
  const counted = `${answers.length} permissions`;
  const { label } = answers[0];
  if (!denied) return `${counted} allowed in ${label}`;
  if (!allowed) return `${counted} denied in ${label}`;
  return `${counted} in ${label}: ${allowed} allowed, ${denied} denied`;
}
