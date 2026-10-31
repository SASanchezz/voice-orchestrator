import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { StaleFileError } from "./file-lines.js";
import { GitChanges } from "./git-changes.js";

const IDENTITY = ["-c", "user.name=test", "-c", "user.email=test@example.com"];

function git(folder: string, ...args: string[]): void {
  execFileSync("git", [...IDENTITY, ...args], { cwd: folder, stdio: "ignore" });
}

/** A repository with one committed file. */
function repository(): string {
  const folder = mkdtempSync(join(tmpdir(), "git-changes-"));
  git(folder, "init");
  writeFileSync(join(folder, "a.txt"), "one\ntwo\n");
  git(folder, "add", ".");
  git(folder, "commit", "-m", "first");
  return folder;
}

test("a clean repository has no changed files", async () => {
  const view = await new GitChanges().ofProject("shop", repository());
  assert.deepEqual(view, { project: "shop", isRepository: true, files: [], moreFiles: 0 });
});

test("a folder outside any repository says so", async () => {
  const view = await new GitChanges().ofProject("shop", mkdtempSync(join(tmpdir(), "no-repo-")));
  assert.equal(view.isRepository, false);
});

test("an unknown folder isn't a repository", async () => {
  assert.equal((await new GitChanges().ofProject("shop", "")).isRepository, false);
});

test("an edited file lists its line counts", async () => {
  const folder = repository();
  writeFileSync(join(folder, "a.txt"), "one\nTWO\nthree\n");
  const [file] = (await new GitChanges().ofProject("shop", folder)).files;
  assert.deepEqual([file.path, file.kind, file.additions, file.deletions], ["a.txt", "modified", 2, 1]);
});

test("a file's fingerprint changes when the file changes again", async () => {
  const folder = repository();
  const changes = new GitChanges();
  writeFileSync(join(folder, "a.txt"), "edited\n");
  const before = (await changes.ofProject("shop", folder)).files[0].fingerprint;
  writeFileSync(join(folder, "a.txt"), "edited more\n");
  assert.notEqual((await changes.ofProject("shop", folder)).files[0].fingerprint, before);
});

test("an untracked file inside a new folder is listed by its own path", async () => {
  const folder = repository();
  mkdirSync(join(folder, "src"));
  writeFileSync(join(folder, "src/new.ts"), "x\n");
  const [file] = (await new GitChanges().ofProject("shop", folder)).files;
  assert.deepEqual([file.path, file.kind], ["src/new.ts", "added"]);
});

test("a tracked file's diff comes from git", async () => {
  const folder = repository();
  writeFileSync(join(folder, "a.txt"), "one\nTWO\n");
  assert.match((await new GitChanges().diffOf(folder, "a.txt")).patch, /^\+TWO$/m);
});

test("an untracked file's diff adds its lines", async () => {
  const folder = repository();
  writeFileSync(join(folder, "new.txt"), "hello\n");
  assert.match((await new GitChanges().diffOf(folder, "new.txt")).patch, /^\+hello$/m);
});

test("a secrets file's diff isn't shown", async () => {
  const folder = repository();
  writeFileSync(join(folder, ".env"), "KEY=value\n");
  const diff = await new GitChanges().diffOf(folder, ".env");
  assert.deepEqual([diff.patch, diff.notShownReason !== undefined], ["", true]);
});

test("a very large new file's diff isn't shown", async () => {
  const folder = repository();
  writeFileSync(join(folder, "big.txt"), "x\n".repeat(200_000));
  assert.equal((await new GitChanges().diffOf(folder, "big.txt")).patch, "");
});

test("a file with no changes doesn't count as changed", async () => {
  assert.equal(await new GitChanges().isChanged(repository(), "a.txt"), false);
});

test("a path outside the changes doesn't count as changed", async () => {
  const folder = repository();
  writeFileSync(join(folder, "a.txt"), "edited\n");
  assert.equal(await new GitChanges().isChanged(folder, "../../etc/passwd"), false);
});

test("staging a file marks it fully staged", async () => {
  const folder = repository();
  const changes = new GitChanges();
  writeFileSync(join(folder, "a.txt"), "edited\n");
  await changes.stage(folder, "a.txt");
  assert.equal((await changes.ofProject("shop", folder)).files[0].staged, true);
});

const TEN_LINES = "1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n";

/** A repository whose committed ten-line file was just edited on its first line. */
function editedRepository(): string {
  const folder = repository();
  writeFileSync(join(folder, "a.txt"), TEN_LINES);
  git(folder, "add", ".");
  git(folder, "commit", "-m", "ten lines");
  writeFileSync(join(folder, "a.txt"), `one${TEN_LINES.slice(1)}`);
  return folder;
}

async function fingerprintOfDiff(folder: string, path: string): Promise<string> {
  const { expansion } = await new GitChanges().diffOf(folder, path);
  return expansion?.fingerprint ?? "";
}

test("a diff says how many lines its file has", async () => {
  const { expansion } = await new GitChanges().diffOf(editedRepository(), "a.txt");
  assert.equal(expansion?.lineCount, 10);
});

test("a deleted file offers no lines to expand", async () => {
  const folder = repository();
  git(folder, "rm", "-f", "a.txt");
  assert.equal((await new GitChanges().diffOf(folder, "a.txt")).expansion, undefined);
});

test("hidden lines come from the file, both ends included", async () => {
  const folder = editedRepository();
  const fingerprint = await fingerprintOfDiff(folder, "a.txt");
  assert.deepEqual(await new GitChanges().hiddenLines(folder, "a.txt", { from: 8, to: 10, fingerprint }), [
    "8",
    "9",
    "10",
  ]);
});

test("hidden lines of a file that moved on since its diff are refused", async () => {
  const folder = editedRepository();
  const fingerprint = await fingerprintOfDiff(folder, "a.txt");
  writeFileSync(join(folder, "a.txt"), "shorter now\n");
  const reading = new GitChanges().hiddenLines(folder, "a.txt", { from: 8, to: 10, fingerprint });
  await assert.rejects(reading, StaleFileError);
});

test("hidden lines of a secrets file are refused", async () => {
  const folder = repository();
  writeFileSync(join(folder, ".env"), "KEY=1\n");
  const reading = new GitChanges().hiddenLines(folder, ".env", { from: 1, to: 1, fingerprint: "any" });
  await assert.rejects(reading, /secrets file/);
});

test("a symlink offers no lines to expand", async () => {
  const folder = repository();
  symlinkSync(join(folder, "a.txt"), join(folder, "link.txt"));
  assert.equal((await new GitChanges().diffOf(folder, "link.txt")).expansion, undefined);
});
