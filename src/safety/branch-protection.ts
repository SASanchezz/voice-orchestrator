import { commandFolder } from "./command-folder.js";
import type { GitBranches } from "./git-branches.js";

const GLOB_STAR = /\\\*/g;
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

/**
 * Whether a command's git calls land on a protected branch: one matching config's permissions.protectedBranches,
 * or the branch of the repository's main checkout. Only a linked worktree on any other branch is unprotected.
 */
export class BranchProtection {
  private patterns: RegExp[];

  constructor(
    protectedBranches: string[],
    private branches: GitBranches,
  ) {
    this.patterns = protectedBranches.map(branchPattern);
  }

  /** True whenever it can't tell for sure: an unclear command, a detached HEAD, no repository. */
  async isProtected(command: string, startFolder: string): Promise<boolean> {
    try {
      return await this.landsOnProtectedBranch(command, startFolder);
    } catch {
      return true;
    }
  }

  private async landsOnProtectedBranch(command: string, startFolder: string): Promise<boolean> {
    const folder = commandFolder(command, startFolder);
    const [branch, mainCheckoutBranch] = await Promise.all([
      this.branches.current(folder),
      this.branches.mainCheckout(folder),
    ]);
    return branch === mainCheckoutBranch || this.patterns.some((pattern) => pattern.test(branch));
  }
}

/** "release/*" matches release/1.2 and release/1.2/hotfix. */
function branchPattern(glob: string): RegExp {
  const escaped = glob.replace(REGEX_SPECIALS, "\\$&");
  return new RegExp(`^${escaped.replace(GLOB_STAR, ".*")}$`);
}
