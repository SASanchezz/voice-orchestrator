import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const IDENTITY = ["-c", "user.name=Test", "-c", "user.email=test@example.com"];

/** A repository in a temp folder, its main checkout on `main` with one commit. */
export function makeGitRepo(): string {
  const folder = mkdtempSync(join(tmpdir(), "vo-git-"));
  git(folder, "init", "-q", "-b", "main");
  git(folder, ...IDENTITY, "commit", "-q", "--allow-empty", "-m", "start");
  return folder;
}

/** A linked worktree of `repo` on a new `branch`, in a folder of its own. */
export function addWorktree(repo: string, branch: string): string {
  const folder = join(mkdtempSync(join(tmpdir(), "vo-worktree-")), "wt");
  git(repo, "worktree", "add", "-q", "-b", branch, folder);
  return folder;
}

export function switchToNewBranch(folder: string, branch: string): void {
  git(folder, "checkout", "-q", "-b", branch);
}

export function detachHead(folder: string): void {
  git(folder, "checkout", "-q", "--detach");
}

function git(folder: string, ...args: string[]): void {
  execFileSync("git", ["-C", folder, ...args], { stdio: "ignore" });
}
