import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import type { Input } from "./inputs.js";
import { VoiceHold } from "./voice-hold.js";

const WAIT_MS = 20;
const FILE = { name: "shot.png", path: "/state/attachments/1-ab/shot.png", size: 2048 };

function freshHold(): { hold: VoiceHold; sent: string[] } {
  const sent: string[] = [];
  const loop = { enqueue: (input: Input) => sent.push(input.kind === "user" ? input.text : input.kind) };
  return { hold: new VoiceHold(loop, WAIT_MS), sent };
}

function heldWithDraft(): { hold: VoiceHold; sent: string[]; id: string } {
  const fresh = freshHold();
  fresh.hold.draftChanged("page-1", 1);
  fresh.hold.receive("look at this");
  return { ...fresh, id: fresh.hold.waiting?.id ?? "" };
}

test("voice hold: without files in a draft, what you say goes at once", () => {
  const { hold, sent } = freshHold();
  hold.receive("status");
  assert.deepEqual(sent, ["status"]);
});

test("voice hold: with files in a draft, what you say waits for your choice", () => {
  assert.deepEqual(heldWithDraft().sent, []);
});

test("voice hold: the waiting message is shown with what you said", () => {
  assert.equal(heldWithDraft().hold.waiting?.text, "look at this");
});

test("voice hold: sent with the files, the message lists them", () => {
  const { hold, sent, id } = heldWithDraft();
  hold.sendWithFiles(id, [FILE]);
  assert.deepEqual(sent, ["look at this\n\nAttached files:\n- /state/attachments/1-ab/shot.png (2 KB)"]);
});

test("voice hold: sent alone, the message is just what you said", () => {
  const { hold, sent, id } = heldWithDraft();
  hold.sendAlone(id);
  assert.deepEqual(sent, ["look at this"]);
});

test("voice hold: once chosen, nothing waits any more", () => {
  const { hold, id } = heldWithDraft();
  hold.sendAlone(id);
  assert.equal(hold.waiting, undefined);
});

test("voice hold: what you say while it waits joins the waiting message", () => {
  const { hold } = heldWithDraft();
  hold.receive("and the logs");
  assert.equal(hold.waiting?.text, "look at this and the logs");
});

test("voice hold: without a choice in time, the message goes alone", async () => {
  const { sent } = heldWithDraft();
  await sleep(WAIT_MS * 3);
  assert.deepEqual(sent, ["look at this"]);
});

test("voice hold: once no draft has files, the waiting message goes alone", () => {
  const { hold, sent } = heldWithDraft();
  hold.draftChanged("page-1", 0);
  assert.deepEqual(sent, ["look at this"]);
});

test("voice hold: choosing for a message that already went is refused", () => {
  const { hold, id } = heldWithDraft();
  hold.sendAlone(id);
  assert.throws(() => hold.sendWithFiles(id, [FILE]), /already sent/);
});
