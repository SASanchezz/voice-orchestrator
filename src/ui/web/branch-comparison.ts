// Which two branches the Review view compares, per project, and the files that differ between them. Commits don't move
// under you as a worker's edits do, so a comparison reloads only when you pick a branch or press Refresh.

import { canCompare, defaultComparison } from "../branch-defaults.js";
import type { BranchListView, ComparisonView, ProjectChangesView } from "../change-views.js";
import { fetchBranches, fetchComparison } from "./api.js";
import { store } from "./store.js";

/** The files that differ, or what to say instead: still loading, a branch that's gone, nothing to show. */
export type ComparedFiles = { view: ProjectChangesView } | { note: string };

export interface ProjectComparison {
  branches: BranchListView;
  comparison: ComparisonView;
  files: ComparedFiles;
}

const NO_BRANCHES: BranchListView = { current: "", branches: [] };
const ONE_BRANCH = "This project has only one branch, so there is nothing to compare.";

const comparisons = new Map<string, ProjectComparison>();

export function isComparing(project: string): boolean {
  return comparisons.has(project);
}

/** Throws when the project shows its uncommitted changes. */
export function comparisonOf(project: string): ProjectComparison {
  const entry = comparisons.get(project);
  if (!entry) throw new Error(`${project} isn't comparing branches`);
  return entry;
}

/** In branch mode, a project's file list shows what the branch changed instead of what isn't committed. */
export function shownChanges(view: ProjectChangesView): ProjectChangesView {
  const entry = comparisons.get(view.project);
  if (!entry) return view;
  return "view" in entry.files ? entry.files.view : { ...view, files: [], moreFiles: 0 };
}

/** Starts from the current branch, into the base a pull request usually targets. */
export async function startComparing(project: string): Promise<void> {
  if (isComparing(project)) return;
  comparisons.set(project, { branches: NO_BRANCHES, comparison: { base: "", head: "" }, files: loading() });
  store.rerender();
  await refreshComparison(project);
}

export function stopComparing(project: string): void {
  comparisons.delete(project);
  store.rerender();
}

export async function compareBranches(project: string, comparison: ComparisonView): Promise<void> {
  const entry = comparisonOf(project);
  comparisons.set(project, { ...entry, comparison, files: loading() });
  store.rerender();
  const files = await comparedFiles(project, comparison);
  if (isStillWanted(project, comparison)) comparisons.set(project, { ...comparisonOf(project), files });
  store.rerender();
}

/** Picks up new commits and new branches; the branches you chose stay chosen while they exist. */
export async function refreshComparison(project: string): Promise<void> {
  const branches = await fetchBranches(project).catch(() => NO_BRANCHES);
  if (!isComparing(project)) return;
  const entry = comparisonOf(project);
  if (!canCompare(branches)) {
    comparisons.set(project, { ...entry, branches, files: { note: ONE_BRANCH } });
    return store.rerender();
  }
  comparisons.set(project, { ...entry, branches });
  await compareBranches(project, keptOrDefault(entry.comparison, branches));
}

function keptOrDefault(chosen: ComparisonView, list: BranchListView): ComparisonView {
  const isKept = list.branches.includes(chosen.base) && list.branches.includes(chosen.head);
  return isKept ? chosen : defaultComparison(list);
}

async function comparedFiles(project: string, comparison: ComparisonView): Promise<ComparedFiles> {
  try {
    const view = await fetchComparison(project, comparison);
    return view.files.length ? { view } : { note: `${comparison.head} has no changes that ${comparison.base} lacks.` };
  } catch (error) {
    return { note: error instanceof Error ? error.message : String(error) };
  }
}

/** A slower answer for branches you have since changed is dropped. */
function isStillWanted(project: string, comparison: ComparisonView): boolean {
  const current = comparisons.get(project)?.comparison;
  return current?.base === comparison.base && current.head === comparison.head;
}

function loading(): ComparedFiles {
  return { note: "Comparing…" };
}
