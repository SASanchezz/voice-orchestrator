// The rows of a file's diff in the Review view. Every row, and the lines a hidden range opens into, takes comments.

import type { DiffLine, HiddenRange } from "../diff-lines.js";
import type { CommentBox } from "./diff-comment.js";
import { button, el } from "./dom.js";
import { codeWithSymbols } from "./symbol-links.js";

export type LinesLoader = (range: Pick<HiddenRange, "from" | "to">) => Promise<string[]>;

export function diffEntryRow(entry: DiffLine | HiddenRange, comment: CommentBox, loadLines: LinesLoader): HTMLElement {
  return entry.kind === "hidden" ? hiddenRangeRow(entry, comment, loadLines) : diffRow(entry, comment);
}

export function diffRow(line: DiffLine, comment: CommentBox): HTMLDivElement {
  const number = el("span", { class: "diff-number" }, line.newLine === undefined ? "" : String(line.newLine));
  const text = line.kind === "hunk" ? [line.text] : codeWithSymbols(line.text);
  const row = el("div", { class: `diff-line ${line.kind}` }, number, el("span", { class: "diff-text" }, ...text));
  if (line.kind !== "hunk") row.addEventListener("click", () => comment.aimAt(row, line.newLine));
  return row;
}

function hiddenRangeRow(range: HiddenRange, comment: CommentBox, loadLines: LinesLoader): HTMLDivElement {
  const row = el("div", { class: "diff-hidden" });
  const reveal = (lines: string[]): void => row.replaceWith(...contextRows(lines, range.from, comment));
  const expand = button(rangeLabel(range), "diff-expand", () => void openRange(expand, loadLines(range), reveal));
  row.append(expand);
  return row;
}

/** A failure stays on the control, which you can press again. */
async function openRange(
  expand: HTMLButtonElement,
  lines: Promise<string[]>,
  reveal: (lines: string[]) => void,
): Promise<void> {
  expand.disabled = true;
  try {
    reveal(await lines);
  } catch (error) {
    expand.textContent = error instanceof Error ? error.message : String(error);
    expand.disabled = false;
  }
}

function contextRows(lines: string[], from: number, comment: CommentBox): HTMLDivElement[] {
  return lines.map((text, index) => diffRow({ kind: "context", text, newLine: from + index }, comment));
}

function rangeLabel({ from, to }: HiddenRange): string {
  const count = to - from + 1;
  return count === 1 ? `⋯ Show line ${from}` : `⋯ Show lines ${from}–${to} (${count} hidden)`;
}
