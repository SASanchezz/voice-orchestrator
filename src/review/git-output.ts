// Reading git's machine output into plain records. Paths are NUL-separated, so any file name comes through whole.

import { z } from "zod";
import type { ChangeKind } from "../ui/change-views.js";

export interface StatusEntry {
  path: string;
  kind: ChangeKind;
  staged: boolean;
}

export interface LineCounts {
  additions: number;
  deletions: number;
}

const UNTRACKED = "??";
const UNSTAGED = " ";
const NO_LINE_COUNT = "-"; // git's mark for a binary file
const STATUS_PATH_START = 3; // after the two state letters and a space

const statusLine = z.string().regex(/^.. .+$/s);
const numstatLine = z.string().regex(/^(\d+|-)\t(\d+|-)\t.+$/s);

/** `git status --porcelain --no-renames -z`: two state letters (index, working tree), a space, the path. */
export function parseStatus(output: string): StatusEntry[] {
  return recordsOf(output).map((record) => {
    const line = statusLine.parse(record);
    const state = line.slice(0, 2);
    return { path: line.slice(STATUS_PATH_START), kind: kindOf(state), staged: isFullyStaged(state) };
  });
}

function kindOf(state: string): ChangeKind {
  if (state === UNTRACKED || state.includes("A")) return "added";
  return state.includes("D") ? "deleted" : "modified";
}

function isFullyStaged(state: string): boolean {
  return state !== UNTRACKED && state[0] !== UNSTAGED && state[1] === UNSTAGED;
}

/** `git diff --numstat --no-renames -z`: added lines, deleted lines and the path, by tabs. */
export function parseNumstat(output: string): Map<string, LineCounts> {
  const counts = new Map<string, LineCounts>();
  for (const record of recordsOf(output)) {
    const [additions, deletions, ...path] = numstatLine.parse(record).split("\t");
    counts.set(path.join("\t"), { additions: lineCount(additions), deletions: lineCount(deletions) });
  }
  return counts;
}

function lineCount(field: string): number {
  return field === NO_LINE_COUNT ? 0 : Number(field);
}

function recordsOf(output: string): string[] {
  return output.split("\0").filter((record) => record !== "");
}

/** A file git doesn't track yet, written as the diff that adds it. */
export function patchAddingFile(text: string): string {
  const lines = text.replace(/\n$/, "").split("\n");
  return [`@@ -0,0 +1,${lines.length} @@`, ...lines.map((line) => `+${line}`)].join("\n");
}
