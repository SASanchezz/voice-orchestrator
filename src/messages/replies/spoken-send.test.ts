import assert from "node:assert/strict";
import { test } from "node:test";
import { newDraft, type Draft } from "./draft-store.js";
import { ARMED_FOR_MS, SpokenSend, type ReplySending } from "./spoken-send.js";

class Sending implements ReplySending {
  readonly sent: [string, string][] = [];
  failure?: Error;

  async send(id: string, approvedText: string): Promise<Draft> {
    if (this.failure) throw this.failure;
    this.sent.push([id, approvedText]);
    const message = { sourceKey: "slack:acme", source: "Slack acme", chatId: "D1", chatKind: "dm" as const };
    const triage = { needsReply: true, kind: "chat", urgency: "normal" } as const;
    return newDraft([{ ...message, from: "Bob", messageId: "1" }], "Bob", { triage, text: approvedText });
  }
}

function speaking(): { spoken: SpokenSend; sending: Sending; said: string[]; clock: { now: number } } {
  const sending = new Sending();
  const said: string[] = [];
  const clock = { now: 0 };
  const spoken = new SpokenSend(
    sending,
    (text) => said.push(text),
    () => clock.now,
  );
  return { spoken, sending, said, clock };
}

const flush = async (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("spoken send: only the whole phrase is an answer", () => {
  assert.equal(speaking().spoken.canAnswer("Confirm send."), true);
});

test("spoken send: a sentence holding the phrase isn't", () => {
  assert.equal(speaking().spoken.canAnswer("please confirm send it to Bob"), false);
});

test("spoken send: the armed draft is sent with exactly its armed text", async () => {
  const { spoken, sending } = speaking();
  spoken.arm("d1", "Friday.");
  spoken.answer("confirm send");
  await flush();
  assert.deepEqual(sending.sent, [["d1", "Friday."]]);
});

test("spoken send: with nothing armed, nothing is sent", async () => {
  const { spoken, sending } = speaking();
  assert.match(spoken.answer("confirm send"), /No reply is waiting/);
  await flush();
  assert.equal(sending.sent.length, 0);
});

test("spoken send: an arm that ran out sends nothing", async () => {
  const { spoken, sending, clock } = speaking();
  spoken.arm("d1", "Friday.");
  clock.now = ARMED_FOR_MS + 1;
  spoken.answer("confirm send");
  await flush();
  assert.equal(sending.sent.length, 0);
});

test("spoken send: one confirm sends once", async () => {
  const { spoken, sending } = speaking();
  spoken.arm("d1", "Friday.");
  spoken.answer("confirm send");
  spoken.answer("confirm send");
  await flush();
  assert.equal(sending.sent.length, 1);
});

test("spoken send: a disarmed draft isn't sent", async () => {
  const { spoken, sending } = speaking();
  spoken.arm("d1", "Friday.");
  spoken.disarm("d1");
  spoken.answer("confirm send");
  await flush();
  assert.equal(sending.sent.length, 0);
});

test("spoken send: says who it went to", async () => {
  const { spoken, said } = speaking();
  spoken.arm("d1", "Friday.");
  spoken.answer("confirm send");
  await flush();
  assert.deepEqual(said, ["Sent to Bob."]);
});

test("spoken send: says why it wasn't sent", async () => {
  const { spoken, sending, said } = speaking();
  sending.failure = new Error("Slack is down");
  spoken.arm("d1", "Friday.");
  spoken.answer("confirm send");
  await flush();
  assert.deepEqual(said, ["Not sent: Slack is down"]);
});
