import { test, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { UtteranceMerger } from "./utterance-merger.js";

const GRACE_MS = 1500;

let sent: string[];
let merger: UtteranceMerger;

beforeEach(() => {
  mock.timers.enable({ apis: ["setTimeout"] });
  sent = [];
  merger = new UtteranceMerger(GRACE_MS, (message) => sent.push(message));
});

afterEach(() => mock.timers.reset());

/** One recording from start to transcript, with nothing else overlapping it. */
function record(transcript: string) {
  merger.finish(merger.begin(), transcript);
}

test("a single recording is held for the grace period", () => {
  record("open webshop");
  mock.timers.tick(GRACE_MS - 1);
  assert.deepEqual(sent, []);
});

test("a single recording is sent once the grace period ends", () => {
  record("open webshop");
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, ["open webshop"]);
});

test("a recording started within the grace period is joined to the first", () => {
  record("open webshop");
  mock.timers.tick(1000);
  record("and run the tests");
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, ["open webshop and run the tests"]);
});

test("the grace period restarts after each joined recording", () => {
  record("open webshop");
  mock.timers.tick(1000);
  record("and run the tests");
  mock.timers.tick(GRACE_MS - 1);
  assert.deepEqual(sent, []);
});

test("three quick recordings become one message", () => {
  record("one");
  mock.timers.tick(1200);
  record("two");
  mock.timers.tick(1200);
  record("three");
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, ["one two three"]);
});

test("a recording started after the grace period is a separate message", () => {
  record("first");
  mock.timers.tick(GRACE_MS);
  record("second");
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, ["first", "second"]);
});

test("a recording started while the previous one is transcribing is joined to it", () => {
  const first = merger.begin();
  const second = merger.begin();
  merger.finish(first, "first");
  merger.finish(second, "second");
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, ["first second"]);
});

test("transcripts finishing out of order keep the order they were said in", () => {
  const first = merger.begin();
  const second = merger.begin();
  merger.finish(second, "second");
  mock.timers.tick(GRACE_MS);
  merger.finish(first, "first");
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, ["first second"]);
});

test("nothing is sent while a later recording is still on its way", () => {
  const first = merger.begin();
  merger.begin();
  merger.finish(first, "first");
  mock.timers.tick(GRACE_MS * 10);
  assert.deepEqual(sent, []);
});

test("an empty or failed transcript is skipped in the joined message", () => {
  record("first");
  record("");
  record("third");
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, ["first third"]);
});

test("only empty transcripts send nothing", () => {
  record("");
  record("  ");
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, []);
});

test("it holds from the first recording's start", () => {
  merger.begin();
  assert.equal(merger.isHolding(), true);
});

test("it stops holding once the message is sent", () => {
  record("first");
  mock.timers.tick(GRACE_MS);
  assert.equal(merger.isHolding(), false);
});

test("it stops holding after only empty transcripts", () => {
  record("");
  mock.timers.tick(GRACE_MS);
  assert.equal(merger.isHolding(), false);
});

test("a discarded message is not sent", () => {
  record("never mind this");
  merger.discard();
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, []);
});

test("a recording still transcribing when discarded is not sent once it arrives", () => {
  const slot = merger.begin();
  merger.discard();
  merger.finish(slot, "late words");
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, []);
});

test("a late transcript of a discarded recording doesn't hold up the next message", () => {
  const discarded = merger.begin();
  merger.discard();
  record("next message");
  merger.finish(discarded, "late words");
  mock.timers.tick(GRACE_MS);
  assert.deepEqual(sent, ["next message"]);
});

test("it stops holding once the message is discarded", () => {
  merger.begin();
  merger.discard();
  assert.equal(merger.isHolding(), false);
});
