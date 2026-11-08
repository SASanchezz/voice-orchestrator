import assert from "node:assert/strict";
import { test } from "node:test";
import { messagesSchema } from "../config/messages-config.js";
import { Keychain } from "../secrets/keychain.js";
import { MessengerStatus } from "./messenger-status.js";
import { TelegramCheck } from "./telegram/telegram-check.js";

const ITEM_NOT_FOUND_EXIT_CODE = 44;
const SLACK_ACME = { workspace: "acme", profile: "work" };
const TELEGRAM = { profile: "personal", chats: "all" };

/** A Keychain holding only the items named as "service/account". */
function keychainWith(...items: string[]): Keychain {
  return new Keychain(async (_file, args) => {
    const item = `${args[2]}/${args[4]}`;
    if (items.includes(item)) return { stdout: "" };
    throw Object.assign(new Error("not found"), { code: ITEM_NOT_FOUND_EXIT_CODE });
  });
}

/** A check that hasn't been started, so it is still checking. */
function checkNotStarted(): TelegramCheck {
  return new TelegramCheck(async () => Promise.reject(new Error("not called")));
}

async function statesOf(config: unknown, keychain: Keychain, check = checkNotStarted()): Promise<string[]> {
  const views = await new MessengerStatus(messagesSchema.parse(config), keychain, check).all();
  return views.map(({ name, state }) => `${name} ${state}`);
}

async function finishedCheck(open: () => Promise<void>): Promise<TelegramCheck> {
  const check = new TelegramCheck(async () => {
    await open();
    return {
      listChats: async () => [],
      readMessages: async () => [],
      onIncoming: () => undefined,
      close: async () => undefined,
    };
  });
  check.start();
  await new Promise((resolve) => setImmediate(resolve));
  return check;
}

const TELEGRAM_LOGIN = keychainWith("voice-orchestrator.telegram/session");

test("a Slack workspace in config with its token saved is connected", async () => {
  const keychain = keychainWith("voice-orchestrator.slack/acme");
  assert.deepEqual(await statesOf({ slack: [SLACK_ACME] }, keychain), ["Slack acme connected", "Telegram off"]);
});

test("Telegram is checking until Telegram answers", async () => {
  assert.deepEqual(await statesOf({ telegram: TELEGRAM }, TELEGRAM_LOGIN), ["Slack off", "Telegram checking"]);
});

test("Telegram is connected once it accepts the login", async () => {
  const check = await finishedCheck(async () => undefined);
  assert.deepEqual(await statesOf({ telegram: TELEGRAM }, TELEGRAM_LOGIN, check), ["Slack off", "Telegram connected"]);
});

test("Telegram has failed when it refuses the login", async () => {
  const check = await finishedCheck(async () => Promise.reject(new Error("SESSION_REVOKED")));
  assert.deepEqual(await statesOf({ telegram: TELEGRAM }, TELEGRAM_LOGIN, check), ["Slack off", "Telegram failed"]);
});

test("a messenger in config without its login is half set up", async () => {
  assert.deepEqual(await statesOf({ slack: [SLACK_ACME] }, keychainWith()), ["Slack acme half", "Telegram off"]);
});

test("a Telegram login missing from config is half set up", async () => {
  assert.deepEqual(await statesOf(undefined, TELEGRAM_LOGIN), ["Slack off", "Telegram half"]);
});

test("each Slack workspace gets its own status", async () => {
  const keychain = keychainWith("voice-orchestrator.slack/acme");
  const config = { slack: [SLACK_ACME, { workspace: "beta", profile: "work" }] };
  assert.deepEqual(await statesOf(config, keychain), ["Slack acme connected", "Slack beta half", "Telegram off"]);
});
