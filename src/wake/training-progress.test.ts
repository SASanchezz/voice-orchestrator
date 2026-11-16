import assert from "node:assert/strict";
import { test } from "node:test";
import { TrainingProgress } from "./training-progress.js";

const STARTED_AT = 5_000;

function begun(): TrainingProgress {
  const progress = new TrainingProgress(() => STARTED_AT);
  progress.begin();
  return progress;
}

test("training progress: shows the last line heard", () => {
  const progress = begun();
  progress.heard("Making voices…");
  progress.heard("Training on 40 rows…");
  assert.equal(progress.view().step, "Training on 40 rows…");
});

test("training progress: a blank line keeps the step before it", () => {
  const progress = begun();
  progress.heard("Making voices…");
  progress.heard("   ");
  assert.equal(progress.view().step, "Making voices…");
});

test("training progress: a new training forgets the last one's step", () => {
  const progress = begun();
  progress.heard("Saved model");
  progress.begin();
  assert.equal(progress.view().step, "");
});

test("training progress: says when the training began", () => {
  assert.equal(begun().view().startedAt, STARTED_AT);
});
