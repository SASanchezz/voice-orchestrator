// The Review view's left side: each project with its changed files, a tick for the ones you've reviewed.

import type { ChangedFileView, ProjectChangesView } from "../change-views.js";
import { changeTotals } from "../reviewed-files.js";
import { revealDiff, syncReviewed } from "./diff-pane.js";
import { byId, el } from "./dom.js";
import { isMarkedReviewed, setMarkedReviewed } from "./review-marks.js";
import { store } from "./store.js";

/** The one project whose files are listed; the rest show only their names. */
let openProject = "";

export function renderChangeList(): void {
  const list = byId("change-list", HTMLElement);
  const scrollTop = list.scrollTop;
  list.replaceChildren(...store.changes.map(projectGroup));
  list.scrollTop = scrollTop; // every poll that found something new rebuilds it
}

function projectGroup(view: ProjectChangesView): HTMLElement {
  return el("section", { class: "change-group" }, groupHead(view), ...groupBody(view));
}

/** Choosing another project from the tabs closes the open one, so a list never shows beside another project's diffs. */
function isOpen(view: ProjectChangesView): boolean {
  return view.project === openProject && view.project === store.selectedProjectName;
}

function groupHead(view: ProjectChangesView): HTMLButtonElement {
  const isSelected = view.project === store.selectedProjectName;
  const head = el(
    "button",
    {
      type: "button",
      class: `change-group-head${isSelected ? " selected" : ""}`,
      "aria-expanded": String(isOpen(view)),
    },
    el("span", { class: "change-group-chevron", "aria-hidden": "true" }, "›"),
    el("span", { class: "change-group-name" }, view.project),
    el("span", { class: "badge" }, headNote(view)),
  );
  head.addEventListener("click", () => toggleGroup(view));
  return head;
}

/** Opening a project selects it and closes the one open before; clicking the open one again closes it. */
function toggleGroup(view: ProjectChangesView): void {
  openProject = isOpen(view) ? "" : view.project;
  if (view.project === store.selectedProjectName) return store.rerender();
  store.select(view.project);
}

function headNote(view: ProjectChangesView): string {
  if (!view.isRepository) return "no git";
  if (!view.files.length) return "clean";
  return `${view.files.length} · ${changeTotals(view)}`;
}

/** Only the open project lists its files, so the list stays short with many projects. */
function groupBody(view: ProjectChangesView): HTMLElement[] {
  if (!isOpen(view)) return [];
  const files = view.files.map((file) => fileRow(view.project, file));
  const more = el("p", { class: "change-note" }, `…and ${view.moreFiles} more files`);
  return view.moreFiles ? [...files, more] : files;
}

function fileRow(project: string, file: ChangedFileView): HTMLDivElement {
  const reviewed = isMarkedReviewed(project, file);
  const tick = el("input", { type: "checkbox", title: "Reviewed", "aria-label": `Reviewed ${file.path}` });
  tick.checked = reviewed;
  tick.addEventListener("change", () => {
    setMarkedReviewed(project, file, tick.checked);
    syncReviewed(project, file);
  });
  const name = el("button", { type: "button", title: `${file.path} (${file.kind})` }, `‎${file.path}`);
  name.addEventListener("click", () => revealDiff(file.path));
  return el("div", { class: `change-file${reviewed ? " reviewed" : ""}` }, tick, name);
}
