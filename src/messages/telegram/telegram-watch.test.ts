import assert from "node:assert/strict";
import { test } from "node:test";
import type { TelegramSettings } from "../../config/messages-config.js";
import type { Arrival, ArrivalSink } from "../alerts/arrivals.js";
import { PushingTelegram } from "../../testing/pushing-telegram.js";
import { TelegramWatch } from "./telegram-watch.js";

const WATCHING_BOB: TelegramSettings = { profile: "personal", chats: "all", exclude: [], notify: ["bob"], send: false };

class Arrivals implements ArrivalSink {
  readonly heardOf: Arrival[] = [];

  heard(arrival: Arrival): void {
    this.heardOf.push(arrival);
  }
}

async function watching(telegram: PushingTelegram, settings = WATCHING_BOB): Promise<Arrivals> {
  const arrivals = new Arrivals();
  await new TelegramWatch(settings, async () => telegram, arrivals).start();
  return arrivals;
}

test("telegram watch: a message in a chat under notify is passed on with its chat's name", async () => {
  const telegram = new PushingTelegram();
  const arrivals = await watching(telegram);
  telegram.push({ chatId: "1", from: "Bob", messageId: 7 });
  assert.deepEqual(arrivals.heardOf, [{ source: "Telegram", chat: "Bob", from: "Bob" }]);
});

test("telegram watch: a message in any other chat is ignored", async () => {
  const telegram = new PushingTelegram();
  const arrivals = await watching(telegram);
  telegram.push({ chatId: "2", from: "Ann", messageId: 7 });
  assert.deepEqual(arrivals.heardOf, []);
});

test("telegram watch: an excluded chat isn't watched even when notify names it", async () => {
  const telegram = new PushingTelegram();
  const arrivals = await watching(telegram, { ...WATCHING_BOB, exclude: ["Bob"] });
  telegram.push({ chatId: "1", from: "Bob", messageId: 7 });
  assert.deepEqual(arrivals.heardOf, []);
});

test("telegram watch: a chat the catch-up doesn't read isn't watched", async () => {
  const telegram = new PushingTelegram();
  const arrivals = await watching(telegram, { ...WATCHING_BOB, chats: ["Ann"] });
  telegram.push({ chatId: "1", from: "Bob", messageId: 7 });
  assert.deepEqual(arrivals.heardOf, []);
});

test("telegram watch: keeps its connection open", async () => {
  const telegram = new PushingTelegram();
  await watching(telegram);
  assert.equal(telegram.closed, false);
});

test("telegram watch: lets go of the connection when it can't start", async () => {
  const telegram = new PushingTelegram();
  telegram.listChats = async () => Promise.reject(new Error("flood"));
  await assert.rejects(watching(telegram), /flood/);
  assert.equal(telegram.closed, true);
});
