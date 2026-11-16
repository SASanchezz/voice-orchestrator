import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PermissionMode } from "../config/app-config.js";
import { DESTRUCTIVE_PATH } from "../config/paths.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { workerRules } from "../testing/test-worker-rules.js";
import { EditScope } from "./edit-scope.js";
import { PermissionPolicy } from "./permission-policy.js";

const rulesFile = join(mkdtempSync(join(tmpdir(), "vo-policy-")), "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, rulesFile);
const rules = new DestructiveList(rulesFile);
const PROJECT_FOLDER = "/work/webshop";
const SESSION = "s1";

function policyIn(mode: PermissionMode): PermissionPolicy {
  return new PermissionPolicy(mode, workerRules(rules), new EditScope(() => PROJECT_FOLDER));
}

function allowsWithoutAsking(mode: PermissionMode, command: string): boolean {
  const policy = policyIn(mode);
  const call = { toolName: "Bash", input: { command } };
  return policy.allowsWithoutAsking(SESSION, call, policy.ruleFor(call));
}

function editCall(filePath: string) {
  return { toolName: "Edit", input: { file_path: filePath } };
}

function allowsEditWithoutAsking(policy: PermissionPolicy, filePath: string): boolean {
  return policy.allowsWithoutAsking(SESSION, editCall(filePath), undefined);
}

test("policy: in ask mode a read-only command runs without asking", () => {
  assert.equal(allowsWithoutAsking("ask", "git status && git log -5 | cat; ls deploy/"), true);
});

test("policy: in ask mode a command that changes something asks", () => {
  assert.equal(allowsWithoutAsking("ask", "npm install"), false);
});

test("policy: in auto mode a command that changes something runs without asking", () => {
  assert.equal(allowsWithoutAsking("auto", "npm install"), true);
});

test("policy: reading a secret asks even in auto mode", () => {
  assert.equal(allowsWithoutAsking("auto", "cat .env"), false);
});

test("policy: a destructive command asks even in auto mode", () => {
  assert.equal(allowsWithoutAsking("auto", "git push origin main"), false);
});

test("policy: in ask mode an edit inside the project's folder runs without asking", () => {
  assert.equal(allowsEditWithoutAsking(policyIn("ask"), `${PROJECT_FOLDER}/src/app.ts`), true);
});

test("policy: in ask mode an edit outside the project's folder asks", () => {
  assert.equal(allowsEditWithoutAsking(policyIn("ask"), "/work/shared/config.ts"), false);
});

test("policy: in auto mode an edit outside the project's folder asks too", () => {
  assert.equal(allowsEditWithoutAsking(policyIn("auto"), "/work/shared/config.ts"), false);
});

test("policy: once an outside edit is allowed, edits deeper in its folder run without asking", () => {
  const policy = policyIn("ask");
  policy.rememberAllowed(SESSION, editCall("/work/shared/config.ts"));
  assert.equal(allowsEditWithoutAsking(policy, "/work/shared/nested/other.ts"), true);
});
