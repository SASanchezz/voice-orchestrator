// Which two branches the Review view compares first: the current branch, into the base a pull request usually targets.
// Only types are imported, so the page bundles it and Node tests it.

import type { BranchListView, ComparisonView } from "./change-views.js";

const USUAL_BASES = ["main", "master", "develop", "origin/main", "origin/master", "origin/develop"];

export function canCompare({ branches }: BranchListView): boolean {
  return branches.length > 1;
}

/** Throws when there aren't two branches to compare. */
export function defaultComparison(list: BranchListView): ComparisonView {
  if (!canCompare(list)) throw new Error("This project has only one branch.");
  const head = list.current || list.branches[0];
  const others = list.branches.filter((branch) => branch !== head);
  const base = USUAL_BASES.find((usual) => others.includes(usual)) ?? others[0];
  return { base, head };
}
