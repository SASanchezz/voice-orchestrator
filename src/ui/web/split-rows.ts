// The rows of a file's diff side by side in the Review view: the old file on the left, the new file on the right.
// Either side takes comments, and a hidden range opens into unchanged lines on both sides.

import type { SplitEntry, SplitHiddenRange, SplitLine, SplitRow } from "../split-diff.js";
import type { CommentBox } from "./diff-comment.js";
import { diffRow, hiddenRangeRow, type LinesLoader } from "./diff-rows.js";
import { el } from "./dom.js";
import { codeWithSymbols } from "./symbol-links.js";

export function splitEntryRow(entry: SplitEntry, comment: CommentBox, loadLines: LinesLoader): HTMLElement {
  if (entry.kind === "hidden") return hiddenRangeRow(entry, loadLines, (lines) => unchangedRows(entry, lines, comment));
  if (entry.kind === "split") return splitRow(entry, comment);
  return diffRow(entry, comment);
}

function splitRow(row: SplitRow, comment: CommentBox): HTMLDivElement {
  return el("div", { class: "split-row" }, oldSide(row, comment), newSide(row, comment));
}

/** A removed line has no place in the new file, so a comment on it names none. */
function oldSide({ old, new: replacement }: SplitRow, comment: CommentBox): HTMLDivElement {
  const newLine = old?.kind === "context" ? replacement?.number : undefined;
  return side(old, comment, newLine);
}

function newSide(row: SplitRow, comment: CommentBox): HTMLDivElement {
  return side(row.new, comment, row.new?.number);
}

function side(line: SplitLine | undefined, comment: CommentBox, newLine: number | undefined): HTMLDivElement {
  if (!line) return el("div", { class: "split-side empty" });
  const number = el("span", { class: "diff-number" }, String(line.number));
  const text = el("span", { class: "diff-text" }, ...codeWithSymbols(line.text));
  const cell = el("div", { class: `split-side ${line.kind}` }, number, text);
  cell.addEventListener("click", () => comment.aimAt(cell, newLine));
  return cell;
}

function unchangedRows(range: SplitHiddenRange, lines: string[], comment: CommentBox): HTMLDivElement[] {
  return lines.map((text, index) => splitRow(unchangedRow(text, range.oldFrom + index, range.from + index), comment));
}

function unchangedRow(text: string, oldNumber: number, newNumber: number): SplitRow {
  return {
    kind: "split",
    old: { kind: "context", text, number: oldNumber },
    new: { kind: "context", text, number: newNumber },
  };
}
