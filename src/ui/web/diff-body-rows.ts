// A loaded file diff's rows in the Review view, in either layout: one column, or the old and new file side by side.

import { diffLines, type DiffLine, type HiddenRange, withHiddenRanges } from "../diff-lines.js";
import type { FileDiffView } from "../change-views.js";
import { splitEntries } from "../split-diff.js";
import { type DiffRoute, fetchHiddenLines } from "./api.js";
import type { CommentBox } from "./diff-comment.js";
import type { DiffLayout } from "./diff-layout.js";
import { diffEntryRow, type LinesLoader } from "./diff-rows.js";
import { splitEntryRow } from "./split-rows.js";

export class DiffBodyRows {
  private readonly entries: (DiffLine | HiddenRange)[];
  private readonly loadLines: LinesLoader;

  constructor(
    route: DiffRoute,
    diff: FileDiffView,
    private readonly comment: CommentBox,
  ) {
    const lines = diffLines(diff.patch);
    const { expansion } = diff;
    this.entries = expansion ? withHiddenRanges(lines, expansion.lineCount) : lines;
    // Only hidden ranges load lines, and there are none without an expansion.
    const fingerprint = expansion?.fingerprint ?? "";
    this.loadLines = (range) => fetchHiddenLines(route, diff.path, { ...range, fingerprint });
  }

  rowsIn(layout: DiffLayout): HTMLElement[] {
    return layout === "split" ? this.splitRows() : this.unifiedRows();
  }

  private unifiedRows(): HTMLElement[] {
    return this.entries.map((entry) => diffEntryRow(entry, this.comment, this.loadLines));
  }

  private splitRows(): HTMLElement[] {
    return splitEntries(this.entries).map((entry) => splitEntryRow(entry, this.comment, this.loadLines));
  }
}
