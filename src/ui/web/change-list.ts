// The Review view's left side: each project with its changed files, a tick for the ones you've reviewed. A project
// comparing branches lists the files its branch changed instead. A folder of repositories heads each repository's
// files with its name, which shows just that repository when clicked. The search box above narrows the projects.

import type { ChangedFileView, ProjectChangesView } from "../change-views.js";
import { changeTotals } from "../reviewed-files.js";
import { shownChanges } from "./branch-comparison.js";
import { matchesChangeSearch, noMatchNote, wireChangeSearch } from "./change-search.js";
import { revealDiff, syncReviewed } from "./diff-pane.js";
import { byId, el } from "./dom.js";
import { isMarkedReviewed, setMarkedReviewed } from "./review-marks.js";
import { store } from "./store.js";
import {
  ALL_REPOSITORIES,
  repositoryOfFile,
  showUncommittedIn,
  uncommittedRepositoryOf,
} from "./uncommitted-repository.js";

/** The one project whose files are listed; the rest show only their names. */
let openProject = "";

export function wireChangeList(): void {
  wireChangeSearch(openFirstShown);
}

export function renderChangeList(): void {
  const list = byId("change-list", HTMLElement);
  const scrollTop = list.scrollTop;
  const projects = shownProjects();
  const groups = projects.length ? projects.map(projectGroup) : [el("p", { class: "change-note" }, noMatchNote())];
  byId("change-groups", HTMLElement).replaceChildren(...groups);
  list.scrollTop = scrollTop; // every poll that found something new rebuilds it
}

function shownProjects(): ProjectChangesView[] {
  return store.changes.map(shownChanges).filter(matchesChangeSearch);
}

function openFirstShown(): void {
  const [first] = shownProjects();
  if (first) openGroup(first);
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
  if (isOpen(view)) return closeGroup();
  openGroup(view);
}

function openGroup(view: ProjectChangesView): void {
  openProject = view.project;
  if (view.project === store.selectedProjectName) return store.rerender();
  store.select(view.project);
}

function closeGroup(): void {
  openProject = "";
  store.rerender();
}

function headNote(view: ProjectChangesView): string {
  if (!view.isRepository) return "no git";
  if (!view.files.length) return "clean";
  return `${view.files.length} · ${changeTotals(view)}`;
}

/** Only the open project lists its files, so the list stays short with many projects. */
function groupBody(view: ProjectChangesView): HTMLElement[] {
  if (!isOpen(view)) return [];
  const files = view.files.flatMap((_file, index) => fileRows(view, index));
  const more = el("p", { class: "change-note" }, `…and ${view.moreFiles} more files`);
  return view.moreFiles ? [...files, more] : files;
}

/** The file's row, under its repository's name when it's the first file listed from that repository. */
function fileRows(view: ProjectChangesView, index: number): HTMLElement[] {
  const file = view.files[index];
  const row = fileRow(view.project, file);
  if (!startsRepository(view, index)) return [row];
  return [repositoryHeading(view.project, repositoryOfFile(file)), row];
}

function startsRepository(view: ProjectChangesView, index: number): boolean {
  const showsAllRepositories = Boolean(view.repositories?.length) && uncommittedRepositoryOf(view) === ALL_REPOSITORIES;
  if (!showsAllRepositories || index === 0) return showsAllRepositories;
  return repositoryOfFile(view.files[index - 1]) !== repositoryOfFile(view.files[index]);
}

function repositoryHeading(project: string, repository: string): HTMLButtonElement {
  const heading = el("button", { type: "button", class: "change-repository" }, repository);
  heading.title = `Show only ${repository}`;
  heading.addEventListener("click", () => showUncommittedIn(project, repository));
  return heading;
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
