// The Review list's rows for one tree of changed files: folders that fold, each showing how many of its files you've
// reviewed, and files with their reviewed tick. A folder whose files are all reviewed starts folded, so what is left
// to look at stands out; folding or unfolding one by hand is remembered until the page reloads.

import type { ChangedFileView } from "../change-views.js";
import { filesUnder, type FileLeaf, type FolderNode } from "../change-tree.js";
import { revealDiff, syncReviewed } from "./diff-pane.js";
import { el } from "./dom.js";
import { isMarkedReviewed, setMarkedReviewed } from "./review-marks.js";
import { store } from "./store.js";

const INDENT_PROPERTY = "--depth";
const TOP_DEPTH = 0;

/** Folded or unfolded by hand, by project and folder path. */
const foldedByHand = new Map<string, boolean>();

/** The rows under the tree's root, which itself gets none. */
export function treeRows(project: string, tree: FolderNode): HTMLElement[] {
  return childRows(project, tree, TOP_DEPTH);
}

/** How many of these files are reviewed, as "3/7". */
export function reviewedCount(project: string, files: ChangedFileView[]): string {
  const reviewed = files.filter((file) => isMarkedReviewed(project, file)).length;
  return `${reviewed}/${files.length}`;
}

function childRows(project: string, folder: FolderNode, depth: number): HTMLElement[] {
  const folders = folder.folders.flatMap((child) => folderRows(project, child, depth));
  return [...folders, ...folder.files.map((leaf) => fileRow(project, leaf, depth))];
}

function folderRows(project: string, folder: FolderNode, depth: number): HTMLElement[] {
  const head = folderRow(project, folder, depth);
  if (isFolded(project, folder)) return [head];
  return [head, ...childRows(project, folder, depth + 1)];
}

function folderRow(project: string, folder: FolderNode, depth: number): HTMLButtonElement {
  const files = filesUnder(folder);
  const isDone = isAllReviewed(project, files);
  const attributes = { type: "button", class: `change-folder${isDone ? " reviewed" : ""}` };
  const row = el(
    "button",
    { ...attributes, "aria-expanded": String(!isFolded(project, folder)), title: folder.path },
    el("span", { class: "change-folder-chevron", "aria-hidden": "true" }, "›"),
    el("span", { class: "change-folder-name" }, folder.name),
    el("span", { class: "change-folder-count", title: "Reviewed files" }, reviewedCount(project, files)),
  );
  indent(row, depth);
  row.addEventListener("click", () => toggleFolder(project, folder));
  return row;
}

function isFolded(project: string, folder: FolderNode): boolean {
  return foldedByHand.get(foldKey(project, folder)) ?? isAllReviewed(project, filesUnder(folder));
}

function isAllReviewed(project: string, files: ChangedFileView[]): boolean {
  return files.every((file) => isMarkedReviewed(project, file));
}

function toggleFolder(project: string, folder: FolderNode): void {
  foldedByHand.set(foldKey(project, folder), !isFolded(project, folder));
  store.rerender();
}

function foldKey(project: string, folder: FolderNode): string {
  return `${project}\0${folder.path}`;
}

function fileRow(project: string, { name, file }: FileLeaf, depth: number): HTMLDivElement {
  const reviewed = isMarkedReviewed(project, file);
  const label = el("button", { type: "button", title: `${file.path} (${file.kind})` }, name);
  label.addEventListener("click", () => revealDiff(file.path));
  const staged = file.staged ? [el("span", { class: "change-staged", title: "All changes staged" }, "staged")] : [];
  const row = el("div", { class: `change-file ${file.kind}${reviewed ? " reviewed" : ""}` }, reviewTick(project, file));
  row.append(label, ...staged);
  indent(row, depth);
  return row;
}

function reviewTick(project: string, file: ChangedFileView): HTMLInputElement {
  const tick = el("input", { type: "checkbox", title: "Reviewed", "aria-label": `Reviewed ${file.path}` });
  tick.checked = isMarkedReviewed(project, file);
  tick.addEventListener("change", () => {
    setMarkedReviewed(project, file, tick.checked);
    syncReviewed(project, file);
  });
  return tick;
}

function indent(row: HTMLElement, depth: number): void {
  row.style.setProperty(INDENT_PROPERTY, String(depth));
}
