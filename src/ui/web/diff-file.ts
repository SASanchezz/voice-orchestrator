// One changed file in the Review view: its name and counts, what you can do with it, its diff and a comment box.

import { diffLines, type DiffLine } from "../diff-lines.js";
import type { ChangedFileView, FileDiffView } from "../change-views.js";
import { act } from "./api.js";
import { refreshChanges } from "./change-poll.js";
import { CommentBox } from "./diff-comment.js";
import { button, el } from "./dom.js";
import { isMarkedReviewed, setMarkedReviewed } from "./review-marks.js";

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
  return el("div", { class: "diff-actions" }, mark, stage);
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

/** The diff, or why there is none. All of it goes in as text. */
export function fillDiff(section: HTMLDetailsElement, diff: FileDiffView): void {
  const body = section.querySelector(".diff-body");
  if (!body) return;
  if (diff.notShownReason) return body.replaceChildren(el("p", { class: "diff-note" }, diff.notShownReason));
  const comment = new CommentBox(diff.path);
  const rows = diffLines(diff.patch).map((line) => diffRow(line, comment));
  body.replaceChildren(el("div", { class: "diff-lines" }, ...rows), comment.box);
}

function diffRow(line: DiffLine, comment: CommentBox): HTMLDivElement {
  const number = el("span", { class: "diff-number" }, line.newLine === undefined ? "" : String(line.newLine));
  const row = el("div", { class: `diff-line ${line.kind}` }, number, el("span", { class: "diff-text" }, line.text));
  if (line.kind !== "hunk") row.addEventListener("click", () => comment.aimAt(row, line.newLine));
  return row;
}
