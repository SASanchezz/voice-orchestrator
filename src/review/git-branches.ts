// A project's branches, and the commits two of them stand on, for the Review view's branch comparison.

import type { BranchListView, ComparisonView } from "../ui/change-views.js";
import type { GitRunner } from "./git-runner.js";

/** Symbolic refs such as `origin/HEAD` come out as empty lines, since they only point at another branch. */
const BRANCH_REFS = [
  "for-each-ref",
  "--format=%(if)%(symref)%(then)%(else)%(refname:short)%(end)",
  "refs/heads",
  "refs/remotes",
];
const CURRENT_BRANCH = ["branch", "--show-current"];

/** Both ends of a comparison as commit ids, so a branch moving on can't change a diff halfway through. */
export interface CommitRange {
  baseCommit: string;
  headCommit: string;
}

export async function branchesIn(git: GitRunner, root: string): Promise<BranchListView> {
  const [refs, current] = await Promise.all([git(root, BRANCH_REFS), git(root, CURRENT_BRANCH)]);
  return { current: current.trim(), branches: refs.split("\n").filter(Boolean) };
}

/** Throws, naming the branch, when either end isn't a commit in this repository. */
export async function commitRangeOf(git: GitRunner, root: string, comparison: ComparisonView): Promise<CommitRange> {
  const [baseCommit, headCommit] = await Promise.all([
    commitOf(git, root, comparison.base),
    commitOf(git, root, comparison.head),
  ]);
  return { baseCommit, headCommit };
}

export async function commitOf(git: GitRunner, root: string, branch: string): Promise<string> {
  try {
    return (await git(root, ["rev-parse", "--verify", "--end-of-options", `${branch}^{commit}`])).trim();
  } catch {
    throw new Error(`No branch "${branch}" in this repository.`);
  }
}

/** From the merge base, as a pull request shows it, so newer commits on the base don't count as changes. */
export function rangeArgument({ baseCommit, headCommit }: CommitRange): string {
  return `${baseCommit}...${headCommit}`;
}
