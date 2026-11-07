import { test } from "node:test";
import assert from "node:assert/strict";
import { commandFolder, FolderUnknownError } from "./command-folder.js";

const START = "/repo";

function folderOf(command: string): string {
  return commandFolder(command, START);
}

function assertUnknown(command: string): void {
  assert.throws(() => folderOf(command), FolderUnknownError);
}

test("command folder: git runs where the command starts", () => {
  assert.equal(folderOf("git add -A && git commit -q -m x"), START);
});

test("command folder: a leading cd followed by && moves git", () => {
  assert.equal(folderOf("cd .claude/worktrees/a && git commit -m x"), "/repo/.claude/worktrees/a");
});

test("command folder: git -C moves that git call", () => {
  assert.equal(folderOf("git -C ../wt commit -m x"), "/wt");
});

test("command folder: other programs around git don't change it", () => {
  assert.equal(folderOf("grep -rln '^<<<<<<<' docs src; git commit --no-edit 2>&1 | grep -iE 'error' | head"), START);
});

test("command folder: a cd followed by ; is unknown, since git runs where it started if the cd fails", () => {
  assertUnknown("cd wt; git commit -m x");
});

test("command folder: a cd after the start is unknown", () => {
  assertUnknown("git status && cd wt && git commit -m x");
});

test("command folder: a cd in a subshell is unknown", () => {
  assertUnknown("(cd wt && git commit -m x); git commit -m y");
});

test("command folder: git in two folders is unknown", () => {
  assertUnknown("git -C a commit -m x && git -C b commit -m y");
});

test("command folder: a folder with a variable in it is unknown", () => {
  assertUnknown("cd $WT && git commit -m x");
});

test("command folder: switching branch is unknown", () => {
  assertUnknown("git checkout main && git merge feature");
});

test("command folder: renaming the branch is unknown", () => {
  assertUnknown("git branch -m main && git commit -m x");
});

test("command folder: listing branches is fine", () => {
  assert.equal(folderOf("git branch --list && git commit -m x"), START);
});

test("command folder: --git-dir is unknown", () => {
  assertUnknown("git --git-dir=../other/.git commit -m x");
});

test("command folder: a GIT_DIR variable is unknown", () => {
  assertUnknown("GIT_DIR=../other/.git git commit -m x");
});

test("command folder: git run through another program is unknown", () => {
  assertUnknown("sh -c 'git checkout main && git commit -m x'");
});

test("command folder: git inside $(…) is unknown", () => {
  assertUnknown('echo "$(git checkout main)" && git commit -m x');
});

test("command folder: a harmless $(…) in a commit message is fine", () => {
  assert.equal(folderOf('git commit -m "$(cat msg.txt)"'), START);
});
