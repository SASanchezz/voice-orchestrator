import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PermissionMode } from "../config/app-config.js";
import { DESTRUCTIVE_PATH } from "../config/paths.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { PermissionPolicy } from "./permission-policy.js";

const rulesFile = join(mkdtempSync(join(tmpdir(), "vo-policy-")), "destructive.yaml");
copyFileSync(DESTRUCTIVE_PATH, rulesFile);
const rules = new DestructiveList(rulesFile);

function allowsWithoutAsking(mode: PermissionMode, command: string): boolean {
  const policy = new PermissionPolicy(mode, rules);
  const call = { toolName: "Bash", input: { command } };
  return policy.allowsWithoutAsking(call, policy.ruleFor(call));
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
