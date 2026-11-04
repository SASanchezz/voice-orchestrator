// One file's diff laid out side by side: the old file's lines on the left, the new file's on the right, a removed
// line beside the added line that replaced it. No imports but types, so the page bundles it and Node tests it.

import type { DiffLine, HiddenRange } from "./diff-lines.js";

/** One side of a row, numbered as it is in its own file. */
export interface SplitLine {
  kind: "removed" | "added" | "context";
  text: string;
  number: number;
}

/** A side is missing where one file has more lines than the other at that point. */
export interface SplitRow {
  kind: "split";
  old?: SplitLine;
  new?: SplitLine;
}

/** A hidden range is the same unchanged lines on both sides; `oldFrom` is where they start in the old file. */
export interface SplitHiddenRange extends HiddenRange {
  oldFrom: number;
}

export type SplitEntry = SplitRow | DiffLine | SplitHiddenRange;

const OLD_START = /^@@ -(\d+)/;

/** Takes what withHiddenRanges() gives, or just the diff's lines. Hunk headers pass through as they are. */
export function splitEntries(entries: (DiffLine | HiddenRange)[]): SplitEntry[] {
  const layout = new SplitLayout();
  for (const entry of entries) layout.add(entry);
  return layout.finish();
}

/** Removed and added lines wait until the change they belong to ends, then pair up row by row. */
class SplitLayout {
  private readonly entries: SplitEntry[] = [];
  private removed: SplitLine[] = [];
  private added: SplitLine[] = [];
  private nextOld = 1;
  private nextNew = 1;

  add(entry: DiffLine | HiddenRange): void {
    if (entry.kind === "removed") return void this.removed.push(this.oldLine("removed", entry.text));
    if (entry.kind === "added") return void this.added.push(this.newLine("added", entry));
    this.flushChange();
    if (entry.kind === "hidden") return void this.entries.push(this.hiddenRange(entry));
    if (entry.kind === "hunk") return this.startHunk(entry);
    this.entries.push({ kind: "split", old: this.oldLine("context", entry.text), new: this.newLine("context", entry) });
  }

  finish(): SplitEntry[] {
    this.flushChange();
    return this.entries;
  }

  /** Unchanged lines sit as far apart in the two files as the lines just before them. */
  private hiddenRange(range: HiddenRange): SplitHiddenRange {
    return { ...range, oldFrom: range.from + this.nextOld - this.nextNew };
  }

  private startHunk(hunk: DiffLine): void {
    this.nextOld = Number(OLD_START.exec(hunk.text)?.[1] ?? this.nextOld);
    this.entries.push(hunk);
  }

  private oldLine(kind: SplitLine["kind"], text: string): SplitLine {
    const line = { kind, text, number: this.nextOld };
    this.nextOld += 1;
    return line;
  }

  private newLine(kind: SplitLine["kind"], { text, newLine }: DiffLine): SplitLine {
    const number = newLine ?? this.nextNew;
    this.nextNew = number + 1;
    return { kind, text, number };
  }

  private flushChange(): void {
    const rowCount = Math.max(this.removed.length, this.added.length);
    for (let index = 0; index < rowCount; index++) {
      this.entries.push({ kind: "split", old: this.removed[index], new: this.added[index] });
    }
    this.removed = [];
    this.added = [];
  }
}
