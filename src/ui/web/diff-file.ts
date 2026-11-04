// One changed file in the Review view: its name and counts, what you can do with it, its diff and a comment box.

import type { ChangedFileView, FileDiffView } from "../change-views.js";
import { act } from "./api.js";
import { refreshChanges } from "./change-poll.js";
import { DiffBodyRows } from "./diff-body-rows.js";
import { CommentBox } from "./diff-comment.js";
import { type DiffLayout, layoutOf, layoutToggle, onLayoutChange } from "./diff-layout.js";
import { button, el } from "./dom.js";
import { isMarkedReviewed, setMarkedReviewed } from "./review-marks.js";
import { onSymbolModifierClick } from "./symbol-links.js";
import { showDefinitions } from "./definition-peek.js";

const LOADING = "Loading…";

export function diffFile(project: string, file: ChangedFileView): HTMLDetailsElement {
  const reviewed = isMarkedReviewed(project, file);
  const section = el(
    "details",
    { class: "diff-file", "data-path": file.path },
    fileSummary(file),
    fileActions(project, file, reviewed),
    el("div", { class: "diff-body" }, el("p", { class: "diff-note" }, LOADING)),
  );
  section.open = !reviewed;
  return section;
}

function fileSummary(file: ChangedFileView): HTMLElement {
  const staged = file.staged ? el("span", { class: "badge" }, "staged") : "";
  const isUntracked = file.kind === "added" && !file.additions; // git counts lines only of files it tracks
  const counts = isUntracked ? "" : el("span", { class: "muted" }, `+${file.additions} −${file.deletions}`);
  return el("summary", {}, el("span", {}, file.path), el("span", { class: "badge" }, file.kind), counts, staged);
}

function fileActions(project: string, file: ChangedFileView, reviewed: boolean): HTMLDivElement {
  const mark = button(reviewed ? "Reviewed ✓" : "Mark reviewed", "ghost diff-mark", () => toggleReview(project, file));
  const stage = button("Stage", "ghost", () => void stageFile(project, file));
  stage.disabled = file.staged;
  return el("div", { class: "diff-actions" }, mark, stage, layoutToggle(project, file.path));
}

function toggleReview(project: string, file: ChangedFileView): void {
  setMarkedReviewed(project, file, !isMarkedReviewed(project, file));
  const section = document.querySelector<HTMLDetailsElement>(`.diff-file[data-path="${CSS.escape(file.path)}"]`);
  if (section) syncDiffFile(section, project, file);
}

async function stageFile(project: string, file: ChangedFileView): Promise<void> {
  await act(`/api/projects/${encodeURIComponent(project)}/changes/stage`, { path: file.path });
  await refreshChanges();
}

/** Marking a file reviewed folds it; taking the mark back opens it. */
export function syncDiffFile(section: HTMLDetailsElement, project: string, file: ChangedFileView): void {
  const reviewed = isMarkedReviewed(project, file);
  section.open = !reviewed;
  const mark = section.querySelector(".diff-mark");
  if (mark) mark.textContent = reviewed ? "Reviewed ✓" : "Mark reviewed";
}

/** The diff, or why there is none. All of it goes in as text. Switching layout keeps the comment you're writing. */
export function fillDiff(section: HTMLDetailsElement, project: string, diff: FileDiffView): void {
  const body = section.querySelector<HTMLElement>(".diff-body");
  if (!body) return;
  if (diff.notShownReason) return body.replaceChildren(el("p", { class: "diff-note" }, diff.notShownReason));
  const comment = new CommentBox(diff.path);
  const rows = new DiffBodyRows(project, diff, comment);
  const show = (layout: DiffLayout): void => body.replaceChildren(diffLinesIn(layout, rows), comment.box);
  onSymbolModifierClick(body, (symbol) => void showDefinitions(project, symbol, diff.path));
  onLayoutChange(section, show);
  show(layoutOf(project, diff.path));
}

function diffLinesIn(layout: DiffLayout, rows: DiffBodyRows): HTMLDivElement {
  return el("div", { class: `diff-lines ${layout}` }, ...rows.rowsIn(layout));
}
