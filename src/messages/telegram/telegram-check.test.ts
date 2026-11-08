import assert from "node:assert/strict";
import { test } from "node:test";
import { TelegramCheck } from "./telegram-check.js";
import type { TelegramChats } from "./telegram-port.js";

const SHORT_TIMEOUT_MS = 10;

function closingChats(onClose: () => void): TelegramChats {
  return {
    listChats: async () => [],
    readMessages: async () => [],
    onIncoming: () => undefined,
    close: async () => onClose(),
  };
}

async function settled(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, SHORT_TIMEOUT_MS * 2));
}

test("the check is checking before it is started", () => {
  const check = new TelegramCheck(async () => closingChats(() => undefined));
  assert.deepEqual(check.result(), { state: "checking" });
});

test("a connection Telegram accepts is closed again", async () => {
  let closed = false;
  const check = new TelegramCheck(async () => closingChats(() => (closed = true)));
  check.start();
  await settled();
  assert.equal(closed, true);
});

test("a login Telegram refuses fails with its reason", async () => {
  const check = new TelegramCheck(async () => Promise.reject(new Error("SESSION_REVOKED")));
  check.start();
  await settled();
  assert.deepEqual(check.result(), { state: "failed", reason: "SESSION_REVOKED" });
});

test("a Telegram that doesn't answer fails after the timeout", async () => {
  const check = new TelegramCheck(async () => new Promise<TelegramChats>(() => undefined), SHORT_TIMEOUT_MS);
  check.start();
  await settled();
  assert.equal(check.result().state, "failed");
});
