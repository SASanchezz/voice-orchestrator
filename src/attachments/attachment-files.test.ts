import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { AttachmentFiles } from "./attachment-files.js";

const freshFiles = (): { dir: string; files: AttachmentFiles } => {
  const dir = mkdtempSync(join(tmpdir(), "vo-attachments-"));
  return { dir, files: new AttachmentFiles(dir) };
};

const saveOne = (files: AttachmentFiles, name: string): string =>
  files.save([{ name, bytes: Buffer.from("x") }])[0].path;

test("attachment files: a file keeps its own name", () => {
  assert.equal(basename(saveOne(freshFiles().files, "mockup.png")), "mockup.png");
});

test("attachment files: folders in a name are dropped", () => {
  assert.equal(basename(saveOne(freshFiles().files, "../../etc/passwd")), "passwd");
});

test("attachment files: odd characters in a name become underscores", () => {
  assert.equal(basename(saveOne(freshFiles().files, "a$b;c.txt")), "a_b_c.txt");
});

test("attachment files: two files with the same name are both kept", () => {
  const { files } = freshFiles();
  assert.notEqual(saveOne(files, "same.txt"), saveOne(files, "same.txt"));
});

test("attachment files: a saved file is found by its path", () => {
  const { files } = freshFiles();
  const path = saveOne(files, "log.txt");
  assert.equal(files.require(path), path);
});

test("attachment files: a path outside the folder is refused", () => {
  assert.throws(() => freshFiles().files.require("/etc/hosts"), /No attached file/);
});

test("attachment files: a file placed straight in the folder is refused", () => {
  const { dir, files } = freshFiles();
  writeFileSync(join(dir, "loose.txt"), "x");
  assert.throws(() => files.require(join(dir, "loose.txt")), /No attached file/);
});
