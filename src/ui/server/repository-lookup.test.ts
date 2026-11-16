import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ProjectRepositories } from "../../review/project-repositories.js";
import { HTTP_STATUS, HttpError } from "./http-error.js";
import { RepositoryLookup } from "./repository-lookup.js";

/** A project folder holding the repository `shop` and the plain folder `docs`. */
function projectFolder(): string {
  const folder = mkdtempSync(join(tmpdir(), "repository-lookup-"));
  mkdirSync(join(folder, "shop"));
  execFileSync("git", ["init", "-b", "main"], { cwd: join(folder, "shop"), stdio: "ignore" });
  mkdirSync(join(folder, "docs"));
  return folder;
}

/** Only "store" is a known project, as UiLookup answers. */
function lookupOf(folder: string): RepositoryLookup {
  const folderOf = (project: string): string => {
    if (project !== "store") throw new HttpError(HTTP_STATUS.notFound, `No project ${project}`);
    return folder;
  };
  return new RepositoryLookup({ folderOf }, new ProjectRepositories());
}

function isNotFound(error: unknown): boolean {
  return error instanceof HttpError && error.status === HTTP_STATUS.notFound;
}

test("repository lookup: lists the repositories in a project's folder", async () => {
  const repositories = await lookupOf(projectFolder()).list("store");
  assert.deepEqual(repositories, [{ folder: "shop", current: "main" }]);
});

test("repository lookup: an empty repository is the project's own folder", () => {
  const folder = projectFolder();
  assert.equal(lookupOf(folder).folderOf("store", ""), folder);
});

test("repository lookup: a repository inside the project is its folder", () => {
  const folder = projectFolder();
  assert.equal(lookupOf(folder).folderOf("store", "shop"), join(folder, "shop"));
});

test("repository lookup: a folder that isn't a repository is a 404", () => {
  const lookup = lookupOf(projectFolder());
  assert.throws(() => lookup.folderOf("store", "docs"), isNotFound);
});

test("repository lookup: a path out of the project is a 404", () => {
  const lookup = lookupOf(projectFolder());
  assert.throws(() => lookup.folderOf("store", "../shop"), isNotFound);
});

test("repository lookup: an unknown project is a 404", () => {
  const lookup = lookupOf(projectFolder());
  assert.throws(() => lookup.folderOf("blog", "shop"), isNotFound);
});
