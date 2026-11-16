// Which repository and which two of its branches the Review view compares, per project, and the files that differ
// between them. Commits don't move under you as a worker's edits do, so a comparison reloads only when you pick a
// repository or a branch, or press Refresh.

import { canCompare, defaultComparison } from "../branch-defaults.js";
import type { BranchListView, ComparisonView, ProjectChangesView, RepositoryView } from "../change-views.js";
import { fetchBranches, fetchComparison, fetchRepositories } from "./api.js";
import { rememberRepository, repositoryToCompare } from "./repository-choice.js";
import { store } from "./store.js";

/** The files that differ, or what to say instead: still loading, a branch that's gone, nothing to show. */
export type ComparedFiles = { view: ProjectChangesView } | { note: string };

export interface ProjectComparison {
  repositories: RepositoryView[];
  /** The compared repository's folder inside the project; empty for the project's own folder. */
  repository: string;
  branches: BranchListView;
  comparison: ComparisonView;
  files: ComparedFiles;
}

const NO_BRANCHES: BranchListView = { current: "", branches: [] };
const NO_COMPARISON: ComparisonView = { base: "", head: "" };
const ONE_BRANCH = "This repository has only one branch, so there is nothing to compare.";
const NO_REPOSITORY =
  "This project's folder neither is nor holds a git repository with commits, so there are no branches to compare.";

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

/** Starts from the repository picked last, its current branch, into the base a pull request usually targets. */
export async function startComparing(project: string): Promise<void> {
  if (isComparing(project)) return;
  const entry = { repositories: [], repository: "", branches: NO_BRANCHES, comparison: NO_COMPARISON };
  comparisons.set(project, { ...entry, files: loading() });
  store.rerender();
  await refreshComparison(project);
}

export function stopComparing(project: string): void {
  comparisons.delete(project);
  store.rerender();
}

/** Starts the new repository from its own usual branches. */
export async function compareRepository(project: string, repository: string): Promise<void> {
  rememberRepository(project, repository);
  const entry = comparisonOf(project);
  comparisons.set(project, { ...entry, repository, comparison: NO_COMPARISON, files: loading() });
  store.rerender();
  await refreshComparison(project);
}

export async function compareBranches(project: string, comparison: ComparisonView): Promise<void> {
  const { repository } = comparisonOf(project);
  comparisons.set(project, { ...comparisonOf(project), comparison, files: loading() });
  store.rerender();
  const files = await comparedFiles(project, repository, comparison);
  if (isStillWanted(project, repository, comparison)) comparisons.set(project, { ...comparisonOf(project), files });
  store.rerender();
}

/** Picks up new repositories, commits and branches; what you chose stays chosen while it exists. */
export async function refreshComparison(project: string): Promise<void> {
  const repositories = await fetchRepositories(project).catch((): RepositoryView[] => []);
  const repository = repositoryToCompare(project, repositories);
  const branches = await fetchBranches(project, repository).catch(() => NO_BRANCHES);
  const isOutdated = !isComparing(project) || repositoryToCompare(project, repositories) !== repository;
  if (isOutdated) return;
  const entry = { ...comparisonOf(project), repositories, repository, branches };
  if (!canCompare(branches)) {
    comparisons.set(project, { ...entry, files: { note: reasonNotComparable(branches) } });
    return store.rerender();
  }
  comparisons.set(project, entry);
  await compareBranches(project, keptOrDefault(entry.comparison, branches));
}

function reasonNotComparable({ branches }: BranchListView): string {
  return branches.length ? ONE_BRANCH : NO_REPOSITORY;
}

function keptOrDefault(chosen: ComparisonView, list: BranchListView): ComparisonView {
  const isKept = list.branches.includes(chosen.base) && list.branches.includes(chosen.head);
  return isKept ? chosen : defaultComparison(list);
}

async function comparedFiles(project: string, repository: string, comparison: ComparisonView): Promise<ComparedFiles> {
  try {
    const view = await fetchComparison(project, repository, comparison);
    return view.files.length ? { view } : { note: `${comparison.head} has no changes that ${comparison.base} lacks.` };
  } catch (error) {
    return { note: error instanceof Error ? error.message : String(error) };
  }
}

/** A slower answer for a repository or branches you have since changed is dropped. */
function isStillWanted(project: string, repository: string, comparison: ComparisonView): boolean {
  const current = comparisons.get(project);
  const isSameRepository = current?.repository === repository;
  return isSameRepository && current.comparison.base === comparison.base && current.comparison.head === comparison.head;
}

function loading(): ComparedFiles {
  return { note: "Comparing…" };
}
