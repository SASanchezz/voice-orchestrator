import { test } from "node:test";
import assert from "node:assert/strict";
import { EditScope } from "./edit-scope.js";

const PROJECT_FOLDER = "/work/webshop";
const SESSION = "s1";
const OTHER_SESSION = "s2";

function scope(): EditScope {
  return new EditScope(() => PROJECT_FOLDER);
}

function edit(filePath: string) {
  return { toolName: "Write", input: { file_path: filePath } };
}

test("edit scope: a relative path is read from the project's folder", () => {
  assert.equal(scope().allows(SESSION, edit("src/app.ts")), true);
});

test("edit scope: a path that climbs out of the project's folder is outside it", () => {
  assert.equal(scope().allows(SESSION, edit("../billing/app.ts")), false);
});

test("edit scope: a folder whose name only starts like the project's is outside it", () => {
  assert.equal(scope().allows(SESSION, edit("/work/webshop-old/app.ts")), false);
});

test("edit scope: a file with secrets in the project's folder still asks", () => {
  assert.equal(scope().allows(SESSION, edit(`${PROJECT_FOLDER}/.env`)), false);
});

test("edit scope: a tool that doesn't edit files is not covered", () => {
  assert.equal(scope().allows(SESSION, { toolName: "Bash", input: { command: "touch a.ts" } }), false);
});

test("edit scope: an allowed outside folder doesn't cover its parent folder", () => {
  const edits = scope();
  edits.allowFolderOf(SESSION, edit("/work/shared/lib/config.ts"));
  assert.equal(edits.allows(SESSION, edit("/work/shared/readme.md")), false);
});

test("edit scope: an allowed outside folder is only for the session it was allowed in", () => {
  const edits = scope();
  edits.allowFolderOf(SESSION, edit("/work/shared/config.ts"));
  assert.equal(edits.allows(OTHER_SESSION, edit("/work/shared/config.ts")), false);
});
