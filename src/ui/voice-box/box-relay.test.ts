import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { BoxChooser } from "./box-chooser.js";
import { BoxRelay } from "./box-relay.js";
import { TestBox } from "../../testing/test-boxes.js";

const SESSION = "s1";
const WORDS = "add a dark mode";

/** Stands in for the shared mic: its news, and the words it keeps when stopped to edit. */
class FakeMic extends EventEmitter {
  current = "recording";

  keep(): Promise<string> {
    this.current = "idle";
    return Promise.resolve(WORDS);
  }

  state(): string {
    return this.current;
  }
}

function boxRelay(session?: string): { relay: BoxRelay; chooser: BoxChooser; mic: FakeMic } {
  const chooser = new BoxChooser();
  const front = { hasSession: () => session !== undefined, session: () => session ?? "" };
  const mic = new FakeMic();
  const relay = new BoxRelay(chooser, front, mic);
  relay.follow();
  return { relay, chooser, mic };
}

function startedOn(box: TestBox, session?: string): ReturnType<typeof boxRelay> {
  const parts = boxRelay(session);
  parts.chooser.used(box);
  parts.mic.emit("started");
  return parts;
}

test("box relay: a recording goes to the box chosen", () => {
  const box = new TestBox();
  startedOn(box);
  assert.deepEqual(box.told, [{ kind: "started", session: undefined }]);
});

test("box relay: a recording says the session in front when it started", () => {
  const box = new TestBox();
  startedOn(box, SESSION);
  assert.deepEqual(box.told, [{ kind: "started", session: SESSION }]);
});

test("box relay: a claim counts for the recording that starts", () => {
  const [used, claimed] = [new TestBox(), new TestBox()];
  const { chooser, mic } = boxRelay();
  chooser.used(used);
  chooser.claim(claimed);
  mic.emit("started");
  assert.equal(claimed.told.length, 1);
});

test("box relay: with no box open, nothing is told", () => {
  const box = new TestBox();
  box.open = false;
  startedOn(box);
  assert.deepEqual(box.told, []);
});

test("box relay: your words so far go to the box", () => {
  const box = new TestBox();
  const { mic } = startedOn(box);
  mic.emit("words", "add a dark");
  assert.deepEqual(box.told.at(-1), { kind: "words", words: "add a dark" });
});

test("box relay: the box takes your words to send them", () => {
  const box = new TestBox();
  const { relay } = startedOn(box);
  assert.equal(relay.takes(WORDS), true);
});

test("box relay: the box is told to send your words", () => {
  const box = new TestBox();
  const { relay } = startedOn(box);
  relay.takes(WORDS);
  assert.deepEqual(box.told.at(-1), { kind: "send", words: WORDS });
});

test("box relay: a box that closed meanwhile can't take your words", () => {
  const box = new TestBox();
  const { relay } = startedOn(box);
  box.open = false;
  assert.equal(relay.takes(WORDS), false);
});

test("box relay: words that went on without the box put it back as it was", () => {
  const box = new TestBox();
  const { relay } = startedOn(box);
  relay.passedBy();
  assert.deepEqual(box.told.at(-1), { kind: "ended" });
});

test("box relay: a cancelled recording empties the box", () => {
  const box = new TestBox();
  const { mic } = startedOn(box);
  mic.emit("cancelled");
  assert.deepEqual(box.told.at(-1), { kind: "cancelled" });
});

test("box relay: a recording stopped at its limit keeps its words in the box", () => {
  const box = new TestBox();
  const { mic } = startedOn(box);
  mic.emit("kept", "a long story");
  assert.deepEqual(box.told.at(-1), { kind: "kept", words: "a long story" });
});

test("box relay: stopping to edit keeps your words in the box", async () => {
  const box = new TestBox();
  const { relay } = startedOn(box);
  await relay.stopToEdit();
  assert.deepEqual(box.told.at(-1), { kind: "kept", words: WORDS });
});

test("box relay: stopping to edit with no recording going does nothing", async () => {
  const box = new TestBox();
  const { relay, mic } = startedOn(box);
  mic.current = "idle";
  await relay.stopToEdit();
  assert.equal(box.told.length, 1);
});

test("box relay: once a recording ended, the box hears no more of it", () => {
  const box = new TestBox();
  const { relay, mic } = startedOn(box);
  relay.passedBy();
  mic.emit("words", "late words");
  assert.deepEqual(box.told.at(-1), { kind: "ended" });
});
