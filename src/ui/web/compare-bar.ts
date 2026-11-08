// The bar over the Review view's diffs: the selected project's uncommitted changes, or what one of its branches adds
// to another, as a pull request would show it.

import {
  compareBranches,
  comparisonOf,
  isComparing,
  refreshComparison,
  startComparing,
  stopComparing,
} from "./branch-comparison.js";
import { button, byId, el } from "./dom.js";
import { store } from "./store.js";

export function renderCompareBar(): void {
  const bar = byId("compare-bar", HTMLElement);
  const project = store.selectedProjectName;
  bar.hidden = !project;
  const key = project ? barKey(project) : "";
  if (!project || bar.dataset.key === key) return; // redrawing would close a branch list you have open
  bar.dataset.key = key;
  bar.replaceChildren(modeButtons(project), ...branchPickers(project));
}

function barKey(project: string): string {
  if (!isComparing(project)) return `${project}\nchanges`;
  const { branches, comparison } = comparisonOf(project);
  return [project, comparison.head, comparison.base, ...branches.branches].join("\n");
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

function branchPickers(project: string): HTMLElement[] {
  if (!isComparing(project)) return [];
  const { branches, comparison } = comparisonOf(project);
  const head = branchSelect("Branch to review", branches.branches, comparison.head);
  const base = branchSelect("Base branch", branches.branches, comparison.base);
  const compare = (): void => void compareBranches(project, { base: base.value, head: head.value });
  head.addEventListener("change", compare);
  base.addEventListener("change", compare);
  const swap = button("⇄", "ghost", () => void compareBranches(project, { base: head.value, head: base.value }));
  swap.title = "Swap the branches";
  const refresh = button("Refresh", "ghost", () => void refreshComparison(project));
  refresh.title = "Pick up new commits and branches";
  return [head, el("span", { class: "muted" }, "into"), base, swap, refresh];
}

function branchSelect(label: string, branches: string[], selected: string): HTMLSelectElement {
  const select = el("select", { "aria-label": label, title: label }, ...branches.map(branchOption));
  select.value = selected;
  return select;
}

function branchOption(branch: string): HTMLOptionElement {
  return el("option", { value: branch }, branch);
}
