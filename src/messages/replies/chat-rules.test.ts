import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ChatRules } from "./chat-rules.js";
import type { ChatRef } from "./inbound.js";

const BOB: ChatRef = { sourceKey: "slack:acme", chatId: "D1", chatKind: "dm" };
const DEPLOYS: ChatRef = { sourceKey: "slack:acme", chatId: "C1", chatKind: "group" };

function rulesFile(): string {
  return join(mkdtempSync(join(tmpdir(), "chat-rules-")), "chat-rules.json");
}

test("chat rules: a DM gets a draft by default", () => {
  assert.equal(new ChatRules(rulesFile()).ruleFor(BOB).mode, "draft");
});

test("chat rules: a group DM gets a draft by default", () => {
  const rule = new ChatRules(rulesFile()).ruleFor({ ...BOB, chatKind: "group-dm" });
  assert.equal(rule.mode, "draft");
});

test("chat rules: a channel only gets the notice by default", () => {
  assert.equal(new ChatRules(rulesFile()).ruleFor(DEPLOYS).mode, "notify");
});

test("chat rules: the default alert is the quiet pop-up", () => {
  assert.equal(new ChatRules(rulesFile()).ruleFor(BOB).alert, "popup");
});

test("chat rules: a change applies to the next lookup", () => {
  const rules = new ChatRules(rulesFile());
  rules.change(BOB, { mode: "silent" });
  assert.equal(rules.ruleFor(BOB).mode, "silent");
});

test("chat rules: a change keeps the chat's other settings", () => {
  const rules = new ChatRules(rulesFile());
  rules.change(BOB, { project: "billing" });
  rules.change(BOB, { priority: "vip" });
  assert.equal(rules.ruleFor(BOB).project, "billing");
});

test("chat rules: a change to one chat leaves the others on their defaults", () => {
  const rules = new ChatRules(rulesFile());
  rules.change(BOB, { mode: "ignore" });
  assert.equal(rules.ruleFor({ ...BOB, chatId: "D2" }).mode, "draft");
});

test("chat rules: a change survives a new store on the same file", () => {
  const file = rulesFile();
  new ChatRules(file).change(BOB, { note: "formal" });
  assert.equal(new ChatRules(file).ruleFor(BOB).note, "formal");
});

test("chat rules: a hand edit to the file applies without a restart", () => {
  const file = rulesFile();
  const rules = new ChatRules(file);
  writeFileSync(file, JSON.stringify({ "slack:acme": { D1: { mode: "silent" } } }));
  assert.equal(rules.ruleFor(BOB).mode, "silent");
});

test("chat rules: a damaged file says so", () => {
  const file = rulesFile();
  writeFileSync(file, JSON.stringify({ "slack:acme": { D1: { mode: "shout" } } }));
  assert.throws(() => new ChatRules(file).ruleFor(BOB), /chat rules file.*damaged/);
});
