import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_PROTECTED_BRANCHES } from "../config/app-config.js";
import { addWorktree, detachHead, makeGitRepo, switchToNewBranch } from "../testing/test-git-repo.js";
import { BranchProtection } from "./branch-protection.js";
import { GitBranches } from "./git-branches.js";

const COMMIT = "git commit -m x";
const protection = new BranchProtection(DEFAULT_PROTECTED_BRANCHES, new GitBranches());

test("branch protection: the main checkout is protected", async () => {
  assert.equal(await protection.isProtected(COMMIT, makeGitRepo()), true);
});

test("branch protection: the main checkout is protected on a feature branch too", async () => {
  const repo = makeGitRepo();
  switchToNewBranch(repo, "feature/x");
  assert.equal(await protection.isProtected(COMMIT, repo), true);
});

test("branch protection: a worktree on a feature branch is not protected", async () => {
  const repo = makeGitRepo();
  assert.equal(await protection.isProtected(COMMIT, addWorktree(repo, "worktree-agent-a1")), false);
});

test("branch protection: a cd into a worktree is followed", async () => {
  const repo = makeGitRepo();
  const worktree = addWorktree(repo, "feature/x");
  assert.equal(await protection.isProtected(`cd ${worktree} && ${COMMIT}`, repo), false);
});

test("branch protection: a worktree on a branch matching a pattern is protected", async () => {
  const repo = makeGitRepo();
  assert.equal(await protection.isProtected(COMMIT, addWorktree(repo, "release/1.2")), true);
});

test("branch protection: a detached HEAD is protected", async () => {
  const worktree = addWorktree(makeGitRepo(), "feature/x");
  detachHead(worktree);
  assert.equal(await protection.isProtected(COMMIT, worktree), true);
});

test("branch protection: a folder outside any repository is protected", async () => {
  assert.equal(await protection.isProtected(COMMIT, mkdtempSync(join(tmpdir(), "vo-no-git-"))), true);
});

test("branch protection: a command whose folder is unclear is protected", async () => {
  const worktree = addWorktree(makeGitRepo(), "feature/x");
  assert.equal(await protection.isProtected(`cd sub; ${COMMIT}`, worktree), true);
});
