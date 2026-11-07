import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DESTRUCTIVE_PATH } from "../config/paths.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { addWorktree, makeGitRepo } from "../testing/test-git-repo.js";
import { workerRules } from "../testing/test-worker-rules.js";

const rulesFile = join(mkdtempSync(join(tmpdir(), "vo-scoped-")), "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, rulesFile);
const destructive = new DestructiveList(rulesFile);
const repo = makeGitRepo();
const worktree = addWorktree(repo, "worktree-agent-a1");
let calls = 0;

/** The verb of the rule that applies once the hook has checked `command` in `folder`. */
async function verbAfterCheck(command: string, folder: string): Promise<string | undefined> {
  const rules = workerRules(destructive);
  const call = { toolName: "Bash", input: { command } };
  const toolUseId = `t${++calls}`;
  await rules.checkBranch(call, folder, toolUseId);
  return rules.ruleFor(call, toolUseId)?.verb;
}

test("branch-scoped rules: a commit on a worktree branch needs no phrase", async () => {
  assert.equal(await verbAfterCheck("git add -A && git commit --no-edit -q", worktree), undefined);
});

test("branch-scoped rules: a merge on a worktree branch needs no phrase", async () => {
  assert.equal(await verbAfterCheck("git merge --no-ff --no-edit worktree-agent-b2", worktree), undefined);
});

test("branch-scoped rules: a commit in the main checkout needs the phrase", async () => {
  assert.equal(await verbAfterCheck("git commit -m x", repo), "commit");
});

test("branch-scoped rules: a merge in the main checkout needs the phrase", async () => {
  assert.equal(await verbAfterCheck("git merge feature", repo), "merge");
});

test("branch-scoped rules: a push next to a worktree commit still needs the phrase", async () => {
  assert.equal(await verbAfterCheck("git commit -m x && git push", worktree), "push");
});

test("branch-scoped rules: a worktree commit next to an unscoped rule still needs a phrase", async () => {
  assert.notEqual(await verbAfterCheck("rm -rf src && git commit -m x", worktree), undefined);
});

test("branch-scoped rules: a call the hook never checked keeps every rule", () => {
  const call = { toolName: "Bash", input: { command: "git commit -m x" } };
  assert.equal(workerRules(destructive).ruleFor(call, "never-checked")?.verb, "commit");
});
