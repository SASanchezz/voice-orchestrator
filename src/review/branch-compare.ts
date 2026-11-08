// What one branch adds on top of another, read from git's objects, so neither is checked out and nothing is written.

import { namesSecretFile } from "../safety/secret-files.js";
import { errorMessage } from "../shared/errors.js";
import type {
  BranchListView,
  ChangedFileView,
  ComparisonView,
  FileDiffView,
  ProjectChangesView,
} from "../ui/change-views.js";
import { MAX_LISTED_FILES, MAX_PATCH_BYTES, notShown, SECRET_NOT_SHOWN, TOO_LARGE_NOT_SHOWN } from "./diff-limits.js";
import { branchesIn, commitRangeOf, type CommitRange, rangeArgument } from "./git-branches.js";
import { CommitFiles } from "./git-blob-lines.js";
import type { LinesRequest } from "./git-changes.js";
import { type LineCounts, parseNameStatus, parseNumstat, type StatusEntry } from "./git-output.js";
import { repositoryRootOf, requireRepositoryRoot, runGit, type GitRunner } from "./git-runner.js";

const NAME_STATUS = ["diff", "--name-status", "--no-renames", "-z"];
const NUMSTAT = ["diff", "--numstat", "--no-renames", "-z"];
const PATCH = ["diff", "--no-ext-diff", "--no-color", "--no-renames"];

export class BranchCompare {
  constructor(private git: GitRunner = runGit) {}

  async branchesOf(folder: string): Promise<BranchListView> {
    const root = await repositoryRootOf(this.git, folder);
    return root ? await branchesIn(this.git, root) : { current: "", branches: [] };
  }

  async ofProject(project: string, folder: string, comparison: ComparisonView): Promise<ProjectChangesView> {
    const root = await repositoryRootOf(this.git, folder);
    if (!root) return { project, isRepository: false, files: [], moreFiles: 0 };
    const range = await commitRangeOf(this.git, root, comparison);
    const entries = await this.entriesOf(root, range);
    const counts = parseNumstat(await this.git(root, [...NUMSTAT, rangeArgument(range)]));
    const files = entries.slice(0, MAX_LISTED_FILES).map((entry) => describe(entry, counts, range.headCommit));
    return { project, isRepository: true, files, moreFiles: entries.length - files.length };
  }

  async isChanged(folder: string, comparison: ComparisonView, path: string): Promise<boolean> {
    const root = await repositoryRootOf(this.git, folder);
    if (!root) return false;
    const entries = await this.entriesOf(root, await commitRangeOf(this.git, root, comparison));
    return entries.some((entry) => entry.path === path);
  }

  async diffOf(folder: string, comparison: ComparisonView, path: string): Promise<FileDiffView> {
    if (namesSecretFile(path)) return notShown(path, SECRET_NOT_SHOWN);
    try {
      return await this.readDiff(await requireRepositoryRoot(this.git, folder), comparison, path);
    } catch (e) {
      return notShown(path, errorMessage(e));
    }
  }

  /**
   * The lines a diff left out, read from the head commit the diff was made from (its fingerprint), so they match it
   * even after the branch moves on. Secret files stay as closed as their diffs.
   */
  async hiddenLines(folder: string, path: string, request: LinesRequest): Promise<string[]> {
    if (namesSecretFile(path)) throw new Error(SECRET_NOT_SHOWN);
    const root = await requireRepositoryRoot(this.git, folder);
    const lines = await new CommitFiles(this.git, root).linesOf(request.fingerprint, path);
    return lines.slice(request.from - 1, request.to);
  }

  private async readDiff(root: string, comparison: ComparisonView, path: string): Promise<FileDiffView> {
    const range = await commitRangeOf(this.git, root, comparison);
    const patch = await this.git(root, [...PATCH, rangeArgument(range), "--", path]);
    if (patch.length > MAX_PATCH_BYTES) return notShown(path, TOO_LARGE_NOT_SHOWN);
    return { path, patch, expansion: await new CommitFiles(this.git, root).expansionOf(range.headCommit, path) };
  }

  private async entriesOf(root: string, range: CommitRange): Promise<StatusEntry[]> {
    return parseNameStatus(await this.git(root, [...NAME_STATUS, rangeArgument(range)]));
  }
}

/** A branch's file is reviewed for one head commit: a new commit on the branch asks for a new look. */
function describe(entry: StatusEntry, counts: Map<string, LineCounts>, headCommit: string): ChangedFileView {
  const { additions = 0, deletions = 0 } = counts.get(entry.path) ?? {};
  return { ...entry, additions, deletions, fingerprint: headCommit };
}
