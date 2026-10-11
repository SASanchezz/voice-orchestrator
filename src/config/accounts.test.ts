import { test } from "node:test";
import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import { envForProfile, loginCommand } from "./accounts.js";
import { testConfig } from "../testing/test-config.js";

const DEFAULT_DIR = join(homedir(), ".claude");
const WORK_DIR = join(homedir(), ".claude-work");
const cfg = testConfig({ profiles: { personal: { configDir: DEFAULT_DIR }, work: { configDir: WORK_DIR } } });

test("the default ~/.claude profile runs without CLAUDE_CONFIG_DIR (same Keychain login as plain `claude`)", () => {
  assert.equal(envForProfile(cfg, "personal").CLAUDE_CONFIG_DIR, undefined);
});

test("another profile runs with its own CLAUDE_CONFIG_DIR", () => {
  assert.equal(envForProfile(cfg, "work").CLAUDE_CONFIG_DIR, WORK_DIR);
});

test("logging in to the default profile is plain `claude auth login`", () => {
  assert.equal(loginCommand(DEFAULT_DIR), "claude auth login");
});
