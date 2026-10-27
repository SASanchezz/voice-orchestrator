import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { UtteranceMerger } from "./utterance-merger.js";

let sent: string[];
let merger: UtteranceMerger;

beforeEach(() => {
  sent = [];
  merger = new UtteranceMerger((message) => sent.push(message));
});

/** One recording from start to transcript, with nothing else overlapping it. */
function record(transcript: string) {
  merger.finish(merger.begin(), transcript);
}

test("a single recording is sent as soon as its transcript arrives", () => {
  record("open webshop");
  assert.deepEqual(sent, ["open webshop"]);
});

test("a recording made after the previous message went out is a separate message", () => {
  record("first");
  record("second");
  assert.deepEqual(sent, ["first", "second"]);
});

test("a recording started while the previous one is transcribing is joined to it", () => {
  const first = merger.begin();
  const second = merger.begin();
  merger.finish(first, "first");
  merger.finish(second, "second");
  assert.deepEqual(sent, ["first second"]);
});

test("transcripts finishing out of order keep the order they were said in", () => {
  const first = merger.begin();
  const second = merger.begin();
  merger.finish(second, "second");
  merger.finish(first, "first");
  assert.deepEqual(sent, ["first second"]);
});

test("nothing is sent while a later recording is still on its way", () => {
  const first = merger.begin();
  merger.begin();
  merger.finish(first, "first");
  assert.deepEqual(sent, []);
});

test("an empty or failed transcript is skipped in the joined message", () => {
  const slots = [merger.begin(), merger.begin(), merger.begin()];
  ["first", "", "third"].forEach((transcript, index) => merger.finish(slots[index], transcript));
  assert.deepEqual(sent, ["first third"]);
});

test("only empty transcripts send nothing", () => {
  record("  ");
  assert.deepEqual(sent, []);
});

test("it holds from the first recording's start", () => {
  merger.begin();
  assert.equal(merger.isHolding(), true);
});

test("it stops holding once the message is sent", () => {
  record("first");
  assert.equal(merger.isHolding(), false);
});

test("it stops holding after only empty transcripts", () => {
  record("");
  assert.equal(merger.isHolding(), false);
});

test("a recording still transcribing when discarded is not sent once it arrives", () => {
  const slot = merger.begin();
  merger.discard();
  merger.finish(slot, "late words");
  assert.deepEqual(sent, []);
});

test("a late transcript of a discarded recording doesn't hold up the next message", () => {
  const discarded = merger.begin();
  merger.discard();
  record("next message");
  merger.finish(discarded, "late words");
  assert.deepEqual(sent, ["next message"]);
});

test("it stops holding once the message is discarded", () => {
  merger.begin();
  merger.discard();
  assert.equal(merger.isHolding(), false);
});
