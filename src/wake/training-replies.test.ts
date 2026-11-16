import { test } from "node:test";
import assert from "node:assert/strict";
import type { TrainedEvent } from "./training-event.js";
import { samplesReply, trainedReply, triedReply } from "./training-replies.js";

const CHECKED: TrainedEvent = {
  type: "trained",
  model: "hey_oracle",
  caught: 4,
  checked_wake: 5,
  false_wakes: 0,
  checked_other: 2,
  quiet_false_wakes: 0,
  checked_quiet: 5,
};

test("training replies: too few wake word recordings asks for more", () => {
  assert.equal(
    samplesReply({ type: "samples", wake: 1, other: 0, trained: false }),
    '"Hey Oracle" recorded once, other talk 0 times. Record "Hey Oracle" at least 5 times to train.',
  );
});

test("training replies: enough recordings is ready to train", () => {
  assert.match(samplesReply({ type: "samples", wake: 5, other: 2, trained: false }), /Ready to train/);
});

test("training replies: a trained model is mentioned", () => {
  assert.match(samplesReply({ type: "samples", wake: 20, other: 5, trained: true }), /A trained model is saved\.$/);
});

test("training replies: training says how it did on recordings it didn't learn from", () => {
  assert.equal(
    trainedReply(CHECKED, "on"),
    'Trained. On recordings it didn\'t learn from, it woke on 4 of 5 "Hey Oracle", on 0 of 2 other talk ' +
      "and on 0 of 5 stretches of your quiet room. " +
      "The wake word now listens with it.",
  );
});

test("training replies: with nothing held back, it says how to see how well it hears you", () => {
  assert.match(trainedReply({ ...CHECKED, checked_wake: 0, checked_other: 0 }, "on"), /record 4 or more/);
});

test("training replies: with the wake word off, it says to switch it on", () => {
  assert.match(trainedReply(CHECKED, "off"), /Switch the wake word on to use it\.$/);
});

test("training replies: a try above the threshold would wake", () => {
  assert.equal(
    triedReply({ type: "tried", score: 0.93, threshold: 0.5 }),
    "It would wake (93% sure; it wakes at 50%).",
  );
});

test("training replies: a try below the threshold wouldn't wake", () => {
  assert.match(triedReply({ type: "tried", score: 0.12, threshold: 0.5 }), /^It wouldn't wake \(12% sure/);
});
