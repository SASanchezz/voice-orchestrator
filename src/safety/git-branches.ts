import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const run = promisify(execFile);

const branchSchema = z.string().trim().min(1);
const MAIN_CHECKOUT_BRANCH = /^branch refs\/heads\/(.+)$/m;
const PORCELAIN_BLOCKS = /\n\s*\n/;

/** Which branches are checked out where, read from git. */
export class GitBranches {
  /** The branch checked out in `folder`. Throws when there is none (detached HEAD) or no repository. */
  async current(folder: string): Promise<string> {
    const { stdout } = await run("git", ["-C", folder, "symbolic-ref", "--quiet", "--short", "HEAD"]);
    return branchSchema.parse(stdout);
  }

  /** The branch checked out in the repository's main checkout, from any of its worktrees. Throws when there is none. */
  async mainCheckout(folder: string): Promise<string> {
    const { stdout } = await run("git", ["-C", folder, "worktree", "list", "--porcelain"]);
    const [mainBlock] = z.string().parse(stdout).split(PORCELAIN_BLOCKS);
    return branchSchema.parse(MAIN_CHECKOUT_BRANCH.exec(mainBlock)?.[1]);
  }
}
