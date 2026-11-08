// A repository's files as git stored them in a commit, read without touching the working tree.

import type { LineExpansionView } from "../ui/change-views.js";
import { MAX_FILE_BYTES } from "./file-lines.js";
import type { GitRunner } from "./git-runner.js";

export class CommitFiles {
  constructor(
    private git: GitRunner,
    private root: string,
  ) {}

  /** Throws when the file is missing in that commit, binary or too large to show. */
  async linesOf(commit: string, path: string): Promise<string[]> {
    const object = `${commit}:${path}`;
    const size = Number(await this.git(this.root, ["cat-file", "-s", object]));
    if (size > MAX_FILE_BYTES) throw new Error(`${path} is too large to read`);
    const text = await this.git(this.root, ["cat-file", "blob", object]);
    if (text.includes("\0")) throw new Error(`${path} is binary`);
    return text ? text.replace(/\n$/, "").split("\n") : [];
  }

  /** The head commit is the fingerprint: hidden lines are read from it, so they always match the diff. */
  async expansionOf(headCommit: string, path: string): Promise<LineExpansionView | undefined> {
    try {
      const lines = await this.linesOf(headCommit, path);
      return { lineCount: lines.length, fingerprint: headCommit };
    } catch {
      return undefined; // deleted on the branch, binary or very large
    }
  }
}
