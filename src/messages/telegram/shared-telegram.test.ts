import assert from "node:assert/strict";
import { test } from "node:test";
import { SharedTelegram } from "./shared-telegram.js";
import type { TelegramChats } from "./telegram-port.js";

/** Counts how often Telegram was connected to and disconnected from. */
class Connections {
  opened = 0;
  closed = 0;
  failNext = false;

  readonly connect = async (): Promise<TelegramChats> => {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("offline");
    }
    this.opened++;
    return {
      listChats: async () => [],
      readMessages: async () => [],
      onIncoming: () => undefined,
      close: async () => {
        this.closed++;
      },
    };
  };
}

test("shared telegram: two holders at once share one connection", async () => {
  const connections = new Connections();
  const shared = new SharedTelegram(connections.connect);
  await Promise.all([shared.open(), shared.open()]);
  assert.equal(connections.opened, 1);
});

test("shared telegram: the connection stays open while anyone still holds it", async () => {
  const connections = new Connections();
  const shared = new SharedTelegram(connections.connect);
  const [first] = await Promise.all([shared.open(), shared.open()]);
  await first.close();
  assert.equal(connections.closed, 0);
});

test("shared telegram: the last holder to let go disconnects", async () => {
  const connections = new Connections();
  const shared = new SharedTelegram(connections.connect);
  const holders = await Promise.all([shared.open(), shared.open()]);
  for (const holder of holders) await holder.close();
  assert.equal(connections.closed, 1);
});

test("shared telegram: closing one hold twice lets go only once", async () => {
  const connections = new Connections();
  const shared = new SharedTelegram(connections.connect);
  const [first] = await Promise.all([shared.open(), shared.open()]);
  await first.close();
  await first.close();
  assert.equal(connections.closed, 0);
});

test("shared telegram: opening after everyone let go connects again", async () => {
  const connections = new Connections();
  const shared = new SharedTelegram(connections.connect);
  await (await shared.open()).close();
  await shared.open();
  assert.equal(connections.opened, 2);
});

test("shared telegram: a failed connection is tried afresh next time", async () => {
  const connections = new Connections();
  connections.failNext = true;
  const shared = new SharedTelegram(connections.connect);
  await assert.rejects(shared.open(), /offline/);
  await shared.open();
  assert.equal(connections.opened, 1);
});
