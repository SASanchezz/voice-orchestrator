import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BranchCompare } from "./branch-compare.js";

const IDENTITY = ["-c", "user.name=test", "-c", "user.email=test@example.com"];
const TEN_LINES = "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n";
const FEATURE_INTO_MAIN = { base: "main", head: "feature" };

function git(folder: string, ...args: string[]): void {
  execFileSync("git", [...IDENTITY, ...args], { cwd: folder, stdio: "ignore" });
}

function commitFile(folder: string, path: string, text: string): void {
  writeFileSync(join(folder, path), text);
  git(folder, "add", ".");
  git(folder, "commit", "-m", `write ${path}`);
}

/** `main` has a ten-line file; `feature` edits its first line and adds a file, and is checked out. */
function repositoryWithFeature(): string {
  const folder = mkdtempSync(join(tmpdir(), "branch-compare-"));
  git(folder, "init", "-b", "main");
  commitFile(folder, "a.txt", TEN_LINES);
  git(folder, "checkout", "-b", "feature");
  commitFile(folder, "a.txt", `one${TEN_LINES.slice(1)}`);
  commitFile(folder, "new.txt", "hello\n");
  return folder;
}

async function comparedPaths(folder: string): Promise<string[]> {
  const view = await new BranchCompare().ofProject("shop", folder, FEATURE_INTO_MAIN);
  return view.files.map((file) => `${file.kind} ${file.path}`);
}

async function headFingerprint(folder: string): Promise<string> {
  const { expansion } = await new BranchCompare().diffOf(folder, FEATURE_INTO_MAIN, "a.txt");
  return expansion?.fingerprint ?? "";
}

test("branch compare: lists the branches and the current one", async () => {
  const branches = await new BranchCompare().branchesOf(repositoryWithFeature());
  assert.deepEqual(branches, { current: "feature", branches: ["feature", "main"] });
});

test("branch compare: lists the files the head branch changed", async () => {
  assert.deepEqual(await comparedPaths(repositoryWithFeature()), ["modified a.txt", "added new.txt"]);
});

test("branch compare: newer commits on the base don't count as changes", async () => {
  const folder = repositoryWithFeature();
  git(folder, "checkout", "main");
  commitFile(folder, "later.txt", "on main\n");
  assert.deepEqual(await comparedPaths(folder), ["modified a.txt", "added new.txt"]);
});

test("branch compare: uncommitted changes are left out", async () => {
  const folder = repositoryWithFeature();
  writeFileSync(join(folder, "draft.txt"), "not committed\n");
  assert.deepEqual(await comparedPaths(folder), ["modified a.txt", "added new.txt"]);
});

test("branch compare: counts the lines a file gained and lost", async () => {
  const view = await new BranchCompare().ofProject("shop", repositoryWithFeature(), FEATURE_INTO_MAIN);
  assert.deepEqual([view.files[0].additions, view.files[0].deletions], [1, 1]);
});

test("branch compare: a branch that doesn't exist is refused by name", async () => {
  const reading = new BranchCompare().ofProject("shop", repositoryWithFeature(), { base: "nope", head: "feature" });
  await assert.rejects(reading, /No branch "nope"/);
});

test("branch compare: a file's diff comes from the two branches", async () => {
  const diff = await new BranchCompare().diffOf(repositoryWithFeature(), FEATURE_INTO_MAIN, "a.txt");
  assert.match(diff.patch, /^\+one$/m);
});

test("branch compare: a diff counts the lines of the file on the head branch", async () => {
  const diff = await new BranchCompare().diffOf(repositoryWithFeature(), FEATURE_INTO_MAIN, "a.txt");
  assert.equal(diff.expansion?.lineCount, 10);
});

test("branch compare: hidden lines come from the head branch, not the working tree", async () => {
  const folder = repositoryWithFeature();
  const fingerprint = await headFingerprint(folder);
  writeFileSync(join(folder, "a.txt"), "edited, not committed\n");
  const lines = await new BranchCompare().hiddenLines(folder, "a.txt", { from: 9, to: 10, fingerprint });
  assert.deepEqual(lines, ["9", "10"]);
});

test("branch compare: hidden lines still match their diff after the branch moves on", async () => {
  const folder = repositoryWithFeature();
  const fingerprint = await headFingerprint(folder);
  commitFile(folder, "a.txt", "shorter now\n");
  const lines = await new BranchCompare().hiddenLines(folder, "a.txt", { from: 9, to: 10, fingerprint });
  assert.deepEqual(lines, ["9", "10"]);
});

test("branch compare: hidden lines of a secrets file are refused", async () => {
  const reading = new BranchCompare().hiddenLines(repositoryWithFeature(), ".env", {
    from: 1,
    to: 1,
    fingerprint: "x",
  });
  await assert.rejects(reading, /secrets file/);
});

test("branch compare: a file that isn't in the comparison doesn't count as changed", async () => {
  assert.equal(await new BranchCompare().isChanged(repositoryWithFeature(), FEATURE_INTO_MAIN, "../x"), false);
});

test("branch compare: a secrets file's diff isn't shown", async () => {
  const folder = repositoryWithFeature();
  commitFile(folder, ".env", "KEY=value\n");
  assert.equal((await new BranchCompare().diffOf(folder, FEATURE_INTO_MAIN, ".env")).patch, "");
});
