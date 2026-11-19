import assert from "node:assert/strict";
import { test } from "node:test";
import { messagesSchema } from "../../config/messages-config.js";
import type { SetupCheck } from "../../ui/reply-checkup-views.js";
import { ReplyCheckup, type SetupProbes } from "./reply-checkup.js";
import { ReplyHealth } from "./reply-health.js";

const OK: SetupCheck = { label: "Signed in", status: "ok", detail: "fine" };

function probes(): SetupProbes {
  const fixed = { check: async (): Promise<SetupCheck[]> => [OK] };
  return { slack: fixed, telegram: fixed };
}

function checkup(yaml: object): ReplyCheckup {
  return new ReplyCheckup(messagesSchema.parse(yaml), probes(), new ReplyHealth());
}

test("reply checkup: every messenger in the config gets its checks", async () => {
  const sources = await checkup({
    slack: [{ workspace: "acme", profile: "work", send: true }],
    telegram: { profile: "p" },
  }).run();
  assert.deepEqual(
    sources.map((source) => source.source),
    ["Slack acme", "Telegram"],
  );
});

test("reply checkup: replies off is the first thing said", async () => {
  const [telegram] = await checkup({ telegram: { profile: "p" } }).run();
  assert.deepEqual([telegram.checks[0].label, telegram.checks[0].status], ["Replies turned on", "warn"]);
});

test("reply checkup: a source with replies off has no live checks", async () => {
  const [telegram] = await checkup({ telegram: { profile: "p" } }).run();
  assert.equal(telegram.checks.length, 2);
});

test("reply checkup: a source with replies on adds its live feed, messages and drafts", async () => {
  const [slack] = await checkup({ slack: [{ workspace: "acme", profile: "work", send: true }] }).run();
  assert.deepEqual(slack.checks.map((check) => check.label).slice(-3), ["Live feed", "Messages received", "Drafts"]);
});

test("reply checkup: nothing in the config, nothing to check", async () => {
  assert.deepEqual(await checkup({}).run(), []);
});
