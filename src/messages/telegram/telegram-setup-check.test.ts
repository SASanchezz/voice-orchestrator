import assert from "node:assert/strict";
import { test } from "node:test";
import { PushingTelegram } from "../../testing/pushing-telegram.js";
import { LOGIN_AGAIN } from "./telegram-port.js";
import { TelegramSetupCheck } from "./telegram-setup-check.js";

test("telegram setup check: a working login says how many chats it sees", async () => {
  const [signedIn] = await new TelegramSetupCheck(async () => new PushingTelegram()).check();
  assert.deepEqual([signedIn.status, signedIn.detail], ["ok", "Telegram accepts the login; 2 chats."]);
});

test("telegram setup check: lets go of the shared connection", async () => {
  const telegram = new PushingTelegram();
  await new TelegramSetupCheck(async () => telegram).check();
  assert.equal(telegram.closed, true);
});

test("telegram setup check: a lost login gives the login command", async () => {
  const [signedIn] = await new TelegramSetupCheck(async () => Promise.reject(new Error(LOGIN_AGAIN))).check();
  assert.deepEqual([signedIn.status, signedIn.command], ["fail", "npm run telegram-login"]);
});
