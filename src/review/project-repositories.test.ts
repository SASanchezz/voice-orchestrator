import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ProjectRepositories } from "./project-repositories.js";

function emptyFolder(): string {
  return mkdtempSync(join(tmpdir(), "project-repositories-"));
}

function repositoryAt(folder: string, branch: string): string {
  mkdirSync(folder, { recursive: true });
  execFileSync("git", ["init", "-b", branch], { cwd: folder, stdio: "ignore" });
  return folder;
}

/** `shop` and `admin` are repositories; `docs` is a plain folder and `.cache` a hidden repository. */
function folderOfRepositories(): string {
  const folder = emptyFolder();
  repositoryAt(join(folder, "shop"), "main");
  repositoryAt(join(folder, "admin"), "feature");
  repositoryAt(join(folder, ".cache"), "main");
  mkdirSync(join(folder, "docs"));
  return folder;
}

test("project repositories: a project in a repository has just its own folder", async () => {
  const folder = repositoryAt(emptyFolder(), "main");
  assert.deepEqual(await new ProjectRepositories().list(folder), [{ folder: "", current: "main" }]);
});

test("project repositories: a folder of repositories lists each one inside it with its branch", async () => {
  const repositories = await new ProjectRepositories().list(folderOfRepositories());
  assert.deepEqual(repositories, [
    { folder: "admin", current: "feature" },
    { folder: "shop", current: "main" },
  ]);
});

test("project repositories: a folder without any repository lists none", async () => {
  assert.deepEqual(await new ProjectRepositories().list(emptyFolder()), []);
});

test("project repositories: knows a repository inside the project", () => {
  assert.equal(new ProjectRepositories().has(folderOfRepositories(), "shop"), true);
});

test("project repositories: a plain folder isn't a repository", () => {
  assert.equal(new ProjectRepositories().has(folderOfRepositories(), "docs"), false);
});

test("project repositories: a path that leaves the project folder is refused", () => {
  const folder = folderOfRepositories();
  assert.equal(new ProjectRepositories().has(join(folder, "docs"), "../shop"), false);
});

test("project repositories: a hidden repository is refused", () => {
  assert.equal(new ProjectRepositories().has(folderOfRepositories(), ".cache"), false);
});
