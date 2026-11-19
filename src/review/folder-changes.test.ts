import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FolderChanges } from "./folder-changes.js";
import { GitChanges } from "./git-changes.js";
import { ProjectRepositories } from "./project-repositories.js";

const IDENTITY = ["-c", "user.name=test", "-c", "user.email=test@example.com"];

function git(folder: string, ...args: string[]): void {
  execFileSync("git", [...IDENTITY, ...args], { cwd: folder, stdio: "ignore" });
}

/** A repository with `a.txt` committed. */
function repositoryAt(folder: string): string {
  mkdirSync(folder, { recursive: true });
  git(folder, "init");
  writeFileSync(join(folder, "a.txt"), "one\n");
  git(folder, "add", ".");
  git(folder, "commit", "-m", "first");
  return folder;
}

/** `shop` has `a.txt` edited; `admin` is clean. */
function folderOfRepositories(): string {
  const folder = mkdtempSync(join(tmpdir(), "folder-changes-"));
  writeFileSync(join(repositoryAt(join(folder, "shop")), "a.txt"), "edited\n");
  repositoryAt(join(folder, "admin"));
  return folder;
}

function folderChanges(): FolderChanges {
  return new FolderChanges(new GitChanges(), new ProjectRepositories());
}

test("folder changes: a folder of repositories lists each changed file under its repository's folder", async () => {
  const view = await folderChanges().ofProject("casino", folderOfRepositories());
  assert.deepEqual(
    view.files.map((file) => file.path),
    ["shop/a.txt"],
  );
});

test("folder changes: a folder of repositories names every repository in it, clean ones too", async () => {
  const view = await folderChanges().ofProject("casino", folderOfRepositories());
  assert.deepEqual(view.repositories, ["admin", "shop"]);
});

test("folder changes: a project in a repository reads as before, without repositories", async () => {
  const folder = repositoryAt(mkdtempSync(join(tmpdir(), "folder-changes-")));
  const view = await folderChanges().ofProject("shop", folder);
  assert.deepEqual(view, { project: "shop", isRepository: true, files: [], moreFiles: 0 });
});

test("folder changes: a file's diff is read from its own repository under its full path", async () => {
  const diff = await folderChanges().diffOf(folderOfRepositories(), "shop/a.txt");
  assert.deepEqual([diff.path, diff.patch.includes("+edited")], ["shop/a.txt", true]);
});

test("folder changes: a changed file counts as changed under its full path", async () => {
  assert.equal(await folderChanges().isChanged(folderOfRepositories(), "shop/a.txt"), true);
});

test("folder changes: a path outside every repository of the folder is never changed", async () => {
  assert.equal(await folderChanges().isChanged(folderOfRepositories(), "docs/a.txt"), false);
});

test("folder changes: staging a file stages it in its own repository", async () => {
  const folder = folderOfRepositories();
  const changes = folderChanges();
  await changes.stage(folder, "shop/a.txt");
  const [file] = (await changes.ofProject("casino", folder)).files;
  assert.equal(file.staged, true);
});
