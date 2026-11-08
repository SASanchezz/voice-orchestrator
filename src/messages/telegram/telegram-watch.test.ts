import assert from "node:assert/strict";
import { test } from "node:test";
import type { TelegramSettings } from "../../config/messages-config.js";
import type { Arrival, ArrivalSink } from "../alerts/arrivals.js";
import type { IncomingMessage, TelegramChat, TelegramChats } from "./telegram-port.js";
import { TelegramWatch } from "./telegram-watch.js";

const WATCHING_BOB: TelegramSettings = { profile: "personal", chats: "all", exclude: [], notify: ["bob"] };

function chat(id: string, name: string): TelegramChat {
  return { id, name, kind: "private", unreadCount: 0, lastMessageId: 1, readInboxMaxId: 1 };
}

/** A Telegram whose chat list is fixed, and whose new messages the test sends. */
class PushingTelegram implements TelegramChats {
  closed = false;
  private heard?: (message: IncomingMessage) => void;

  async listChats(): Promise<TelegramChat[]> {
    return [chat("1", "Bob"), chat("2", "Ann")];
  }

  async readMessages(): Promise<never[]> {
    return [];
  }

  onIncoming(heard: (message: IncomingMessage) => void): void {
    this.heard = heard;
  }

  push(message: IncomingMessage): void {
    this.heard?.(message);
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

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
  telegram.push({ chatId: "1", from: "Bob" });
  assert.deepEqual(arrivals.heardOf, [{ source: "Telegram", chat: "Bob", from: "Bob" }]);
});

test("telegram watch: a message in any other chat is ignored", async () => {
  const telegram = new PushingTelegram();
  const arrivals = await watching(telegram);
  telegram.push({ chatId: "2", from: "Ann" });
  assert.deepEqual(arrivals.heardOf, []);
});

test("telegram watch: an excluded chat isn't watched even when notify names it", async () => {
  const telegram = new PushingTelegram();
  const arrivals = await watching(telegram, { ...WATCHING_BOB, exclude: ["Bob"] });
  telegram.push({ chatId: "1", from: "Bob" });
  assert.deepEqual(arrivals.heardOf, []);
});

test("telegram watch: a chat the catch-up doesn't read isn't watched", async () => {
  const telegram = new PushingTelegram();
  const arrivals = await watching(telegram, { ...WATCHING_BOB, chats: ["Ann"] });
  telegram.push({ chatId: "1", from: "Bob" });
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
