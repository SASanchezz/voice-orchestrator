// The bar over the Review view's diffs: the selected project's uncommitted changes, or what one of its branches adds
// to another, as a pull request would show it, in the repository picked when its folder holds several.

import {
  compareBranches,
  comparisonOf,
  isComparing,
  refreshComparison,
  startComparing,
  stopComparing,
} from "./branch-comparison.js";
import type { BranchListView, ProjectChangesView } from "../change-views.js";
import type { PickerOption } from "../picker-match.js";
import { button, byId, el } from "./dom.js";
import { repositoriesKey, repositoryPickers } from "./repository-picker.js";
import { hasOpenPicker, searchPicker } from "./search-picker.js";
import { store } from "./store.js";
import { uncommittedPickerKey, uncommittedPickers } from "./uncommitted-picker.js";

const CURRENT_BRANCH = "current";

export function renderCompareBar(): void {
  const bar = byId("compare-bar", HTMLElement);
  const project = store.selectedProjectName;
  bar.hidden = !project;
  const key = project ? barKey(project) : "";
  if (!project || bar.dataset.key === key || hasOpenPicker(bar)) return; // redrawing would close an open list
  bar.dataset.key = key;
  bar.replaceChildren(modeButtons(project), ...comparisonPickers(project));
}

function barKey(project: string): string {
  if (!isComparing(project)) return `${project}\nchanges\n${uncommittedPickerKey(changesOf(project))}`;
  const entry = comparisonOf(project);
  const { branches, comparison } = entry;
  return [project, repositoriesKey(entry), comparison.head, comparison.base, ...branches.branches].join("\n");
}

function modeButtons(project: string): HTMLDivElement {
  const comparing = isComparing(project);
  const changes = modeButton("Uncommitted", !comparing, () => stopComparing(project));
  const branches = modeButton("Branches", comparing, () => void startComparing(project));
  changes.title = "What isn't committed yet";
  branches.title = "What one branch adds to another, as a pull request would show it";
  return el("div", { class: "compare-modes", role: "group", "aria-label": "Changes to review" }, changes, branches);
}

function modeButton(label: string, isShown: boolean, onClick: () => void): HTMLButtonElement {
  const mode = button(label, `ghost compare-mode${isShown ? " shown" : ""}`, onClick);
  mode.setAttribute("aria-pressed", String(isShown));
  return mode;
}

/** A project with no changes listed yet reads as clean. */
function changesOf(project: string): ProjectChangesView {
  const listed = store.changes.find((view) => view.project === project);
  return listed ?? { project, isRepository: false, files: [], moreFiles: 0 };
}

function comparisonPickers(project: string): HTMLElement[] {
  if (!isComparing(project)) return uncommittedPickers(changesOf(project));
  return [...repositoryPickers(project, comparisonOf(project)), ...branchPickers(project)];
}

function branchPickers(project: string): HTMLElement[] {
  const { branches, comparison } = comparisonOf(project);
  const options = branchOptions(branches);
  const headChoice = { label: "Branch to review", options, selected: comparison.head };
  const baseChoice = { label: "Base branch", options, selected: comparison.base };
  const head = searchPicker(headChoice, (branch) => void compareBranches(project, { ...comparison, head: branch }));
  const base = searchPicker(baseChoice, (branch) => void compareBranches(project, { ...comparison, base: branch }));
  const swapped = { base: comparison.head, head: comparison.base };
  const swap = button("⇄", "ghost", () => void compareBranches(project, swapped));
  swap.title = "Swap the branches";
  const refresh = button("Refresh", "ghost", () => void refreshComparison(project));
  refresh.title = "Pick up new commits and branches";
  return [head, el("span", { class: "muted" }, "into"), base, swap, refresh];
}

function branchOptions({ current, branches }: BranchListView): PickerOption[] {
  return branches.map((branch) => ({ value: branch, label: branch, detail: branch === current ? CURRENT_BRANCH : "" }));
}
