import assert from "node:assert/strict";
import { test } from "node:test";
import type { Arrival } from "./arrivals.js";
import { GATHER_MS, NewMessageAlerts, type Announcer } from "./new-message-alerts.js";

const BOB: Arrival = { source: "Telegram", chat: "Bob", from: "Bob" };

/** Records what is announced. */
class SpokenNotices implements Announcer {
  readonly spoken: string[] = [];

  announce(spoken: string): void {
    this.spoken.push(spoken);
  }
}

/** A wait that ends only when the test says so, and remembers how long each was. */
class HeldWaits {
  readonly lengths: number[] = [];
  private ends: (() => void)[] = [];

  readonly wait = async (ms: number): Promise<void> => {
    this.lengths.push(ms);
    await new Promise<void>((resolve) => this.ends.push(resolve));
  };

  async endAll(): Promise<void> {
    for (const end of this.ends.splice(0)) end();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

function alertsWith(notices: SpokenNotices, waits: HeldWaits): NewMessageAlerts {
  return new NewMessageAlerts(notices, waits.wait);
}

test("new-message alerts: nothing is said before the gathering time is over", () => {
  const notices = new SpokenNotices();
  alertsWith(notices, new HeldWaits()).heard(BOB);
  assert.deepEqual(notices.spoken, []);
});

test("new-message alerts: arrivals gathered meanwhile are said as one notice", async () => {
  const notices = new SpokenNotices();
  const waits = new HeldWaits();
  const alerts = alertsWith(notices, waits);
  alerts.heard(BOB);
  alerts.heard(BOB);
  await waits.endAll();
  assert.deepEqual(notices.spoken, ["Telegram: 2 new messages from Bob."]);
});

test("new-message alerts: one gathering wait runs per batch", () => {
  const waits = new HeldWaits();
  const alerts = alertsWith(new SpokenNotices(), waits);
  alerts.heard(BOB);
  alerts.heard(BOB);
  assert.deepEqual(waits.lengths, [GATHER_MS]);
});

test("new-message alerts: a message after a notice starts a new batch", async () => {
  const notices = new SpokenNotices();
  const waits = new HeldWaits();
  const alerts = alertsWith(notices, waits);
  alerts.heard(BOB);
  await waits.endAll();
  alerts.heard(BOB);
  await waits.endAll();
  assert.deepEqual(notices.spoken, ["Telegram: a new message from Bob.", "Telegram: a new message from Bob."]);
});
