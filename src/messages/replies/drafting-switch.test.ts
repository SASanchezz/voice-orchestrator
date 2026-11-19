import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { DraftingSwitch, SwitchedDraftRequests } from "./drafting-switch.js";
import type { DraftRequests, MessageBurst } from "./reply-inbox.js";

const BURST: MessageBurst = {
  messages: [
    {
      sourceKey: "slack:acme",
      source: "Slack acme",
      chatId: "D1",
      chatKind: "dm",
      from: "Bob",
      messageId: "1",
    },
  ],
  rule: { mode: "draft", alert: "popup", priority: "normal", research: "allowed" },
};

function switchFile(): string {
  return join(mkdtempSync(join(tmpdir(), "drafting-")), "drafting.json");
}

class Requests implements DraftRequests {
  readonly bursts: MessageBurst[] = [];

  requested(burst: MessageBurst): void {
    this.bursts.push(burst);
  }
}

test("drafting is on when nothing was saved", () => {
  assert.equal(new DraftingSwitch(switchFile()).isOn(), true);
});

test("turning drafting off is kept for the next reader", () => {
  const file = switchFile();
  new DraftingSwitch(file).turnOff();
  assert.equal(new DraftingSwitch(file).isOn(), false);
});

test("turning drafting back on is kept", () => {
  const drafting = new DraftingSwitch(switchFile());
  drafting.turnOff();
  drafting.turnOn();
  assert.equal(drafting.isOn(), true);
});

test("a damaged switch file reads as off", () => {
  const file = switchFile();
  writeFileSync(file, "not json");
  assert.equal(new DraftingSwitch(file).isOn(), false);
});

test("a burst is drafted while drafting is on", () => {
  const requests = new Requests();
  new SwitchedDraftRequests(new DraftingSwitch(switchFile()), requests).requested(BURST);
  assert.deepEqual(requests.bursts, [BURST]);
});

test("a burst is dropped while drafting is off", () => {
  const drafting = new DraftingSwitch(switchFile());
  drafting.turnOff();
  const requests = new Requests();
  new SwitchedDraftRequests(drafting, requests).requested(BURST);
  assert.deepEqual(requests.bursts, []);
});
