import assert from "node:assert/strict";
import { test } from "node:test";
import YAML from "yaml";
import { messageProfiles, messagesSchema } from "./messages-config.js";

function parsed(yaml: string): ReturnType<typeof messagesSchema.parse> {
  return messagesSchema.parse(YAML.parse(yaml));
}

test("messages config: a missing block turns reading off", () => {
  assert.deepEqual(messagesSchema.parse(undefined), { slack: [] });
});

test("messages config: a Slack workspace reads no channels unless named", () => {
  const settings = parsed("slack:\n  - workspace: acme\n    profile: work\n");
  assert.deepEqual(settings.slack, [{ workspace: "acme", profile: "work", channels: [] }]);
});

test("messages config: telegram chats accepts all", () => {
  assert.equal(parsed("telegram:\n  profile: personal\n  chats: all\n").telegram?.chats, "all");
});

test("messages config: telegram chats accepts a list of names", () => {
  const settings = parsed("telegram:\n  profile: personal\n  chats: [Family, Bob]\n");
  assert.deepEqual(settings.telegram?.chats, ["Family", "Bob"]);
});

test("messages config: missing telegram chats reads none", () => {
  assert.deepEqual(parsed("telegram:\n  profile: personal\n").telegram?.chats, []);
});

test("messages config: any other chats value is rejected", () => {
  assert.throws(() => parsed("telegram:\n  profile: personal\n  chats: some\n"));
});

test("messages config: lists each source's Claude account", () => {
  const settings = parsed("slack:\n  - workspace: acme\n    profile: work\ntelegram:\n  profile: personal\n");
  assert.deepEqual(messageProfiles(settings), [
    ["slack acme", "work"],
    ["telegram", "personal"],
  ]);
});
