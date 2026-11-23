import { test } from "node:test";
import assert from "node:assert/strict";
import type { ChangedFileView } from "./change-views.js";
import { changeTree, filesUnder, type FolderNode } from "./change-tree.js";

const NO_ROOT = "";

function changed(path: string): ChangedFileView {
  return { path, kind: "modified", additions: 1, deletions: 0, staged: false, fingerprint: path };
}

function treeOf(...paths: string[]): FolderNode {
  return changeTree(paths.map(changed), NO_ROOT);
}

function folderNames(folder: FolderNode): string[] {
  return folder.folders.map((child) => child.name);
}

function fileNames(folder: FolderNode): string[] {
  return folder.files.map((leaf) => leaf.name);
}

test("files at the top stay at the top", () => {
  assert.deepEqual(fileNames(treeOf("main.ts", "package.json")), ["main.ts", "package.json"]);
});

test("files in the same folder share it", () => {
  assert.deepEqual(folderNames(treeOf("src/a.ts", "src/b.ts", "test/c.ts")), ["src", "test"]);
});

test("a folder holding only one folder joins it", () => {
  assert.deepEqual(folderNames(treeOf("src/ui/web/a.ts", "src/ui/web/b.ts")), ["src/ui/web"]);
});

test("a folder holding files keeps its own row", () => {
  const [src] = treeOf("src/main.ts", "src/ui/a.ts").folders;
  assert.deepEqual([src.name, ...folderNames(src)], ["src", "ui"]);
});

test("folders and files are listed by name", () => {
  const tree = treeOf("b.ts", "z/x.ts", "a.ts", "m/y.ts");
  assert.deepEqual([...folderNames(tree), ...fileNames(tree)], ["m", "z", "a.ts", "b.ts"]);
});

test("a root prefix is left off every name", () => {
  const tree = changeTree([changed("shop/src/a.ts")], "shop/");
  assert.deepEqual(folderNames(tree), ["src"]);
});

test("a folder's path runs from the repository's root", () => {
  const tree = changeTree([changed("shop/src/ui/a.ts"), changed("shop/src/b.ts")], "shop/");
  assert.deepEqual(tree.folders[0].folders[0].path, "shop/src/ui/");
});

test("a folder holds every file below it", () => {
  const paths = filesUnder(treeOf("src/a.ts", "src/ui/b.ts", "c.ts").folders[0]).map((file) => file.path);
  assert.deepEqual(paths, ["src/a.ts", "src/ui/b.ts"]);
});
