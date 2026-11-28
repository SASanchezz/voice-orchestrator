import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { claudeDefaultEffort, claudeDefaultModel } from "./claude-default-model.js";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "claude-default-model-"));
}

function writeSettings(dir: string, file: string, content: string): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), content);
}

test("the account's settings name the model", () => {
  const configDir = tempDir();
  writeSettings(configDir, "settings.json", JSON.stringify({ model: "opus[1m]" }));
  assert.equal(claudeDefaultModel(tempDir(), configDir), "opus[1m]");
});

test("the project's own settings win over the account's", () => {
  const project = tempDir();
  const configDir = tempDir();
  writeSettings(configDir, "settings.json", JSON.stringify({ model: "opus" }));
  writeSettings(join(project, ".claude"), "settings.json", JSON.stringify({ model: "sonnet" }));
  assert.equal(claudeDefaultModel(project, configDir), "sonnet");
});

test("no settings naming a model leave it unset", () => {
  assert.equal(claudeDefaultModel(tempDir(), tempDir()), undefined);
});

test("an unreadable settings file names no model", () => {
  const configDir = tempDir();
  writeSettings(configDir, "settings.json", "{ not json");
  assert.equal(claudeDefaultModel(tempDir(), configDir), undefined);
});

test("the account's settings name the effort", () => {
  const configDir = tempDir();
  writeSettings(configDir, "settings.json", JSON.stringify({ effortLevel: "medium" }));
  assert.equal(claudeDefaultEffort(tempDir(), configDir), "medium");
});

test("the project's own effort wins over the account's", () => {
  const project = tempDir();
  const configDir = tempDir();
  writeSettings(configDir, "settings.json", JSON.stringify({ effortLevel: "medium" }));
  writeSettings(join(project, ".claude"), "settings.local.json", JSON.stringify({ effortLevel: "max" }));
  assert.equal(claudeDefaultEffort(project, configDir), "max");
});

test("an effort Claude Code doesn't know leaves it unset", () => {
  const configDir = tempDir();
  writeSettings(configDir, "settings.json", JSON.stringify({ effortLevel: "extreme" }));
  assert.equal(claudeDefaultEffort(tempDir(), configDir), undefined);
});

test("an unknown effort still lets the model be read", () => {
  const configDir = tempDir();
  writeSettings(configDir, "settings.json", JSON.stringify({ model: "opus", effortLevel: "extreme" }));
  assert.equal(claudeDefaultModel(tempDir(), configDir), "opus");
});
