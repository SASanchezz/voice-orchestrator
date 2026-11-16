import assert from "node:assert/strict";
import { test } from "node:test";
import { BackgroundTraining } from "./background-training.js";
import { TrainingProgress } from "./training-progress.js";
import { UnavailableWakeTraining } from "./wake-training.js";

const SAMPLES_REPLY = '"Hey Oracle" recorded 20 times.';
const TRAINED_REPLY = "Trained.";
const STARTED_AT = 1_000;

/** Stands in for the step-by-step training; its training runs until `finish` or `fail` is called. */
class FakeSteps extends UnavailableWakeTraining {
  busy = false;
  private finishTraining?: (reply: string) => void;
  private failTraining?: (error: Error) => void;

  constructor() {
    super("not used");
  }

  override status(): Promise<string> {
    return Promise.resolve(SAMPLES_REPLY);
  }

  override train(): Promise<string> {
    return new Promise((resolve, reject) => {
      this.finishTraining = resolve;
      this.failTraining = reject;
    });
  }

  isBusy(): boolean {
    return this.busy;
  }

  finish(): void {
    this.finishTraining?.(TRAINED_REPLY);
  }

  fail(reason: string): void {
    this.failTraining?.(new Error(reason));
  }
}

/** Stands in for the voice that says how training went. */
class FakeNews {
  told: string[] = [];

  trained(reply: string): void {
    this.told.push(`trained: ${reply}`);
  }

  failed(reason: string): void {
    this.told.push(`failed: ${reason}`);
  }
}

interface Parts {
  training: BackgroundTraining;
  steps: FakeSteps;
  news: FakeNews;
}

function background(): Parts {
  const steps = new FakeSteps();
  const news = new FakeNews();
  const progress = new TrainingProgress(() => STARTED_AT);
  return { training: new BackgroundTraining(steps, news, progress), steps, news };
}

const settled = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

test("background training: answers before training ends, so the window can be closed", async () => {
  assert.match(await background().training.train(), /you can close this window/);
});

test("background training: says how training went once it ends", async () => {
  const { training, steps, news } = background();
  await training.train();
  steps.finish();
  await settled();
  assert.deepEqual(news.told, [`trained: ${TRAINED_REPLY}`]);
});

test("background training: says why training failed", async () => {
  const { training, steps, news } = background();
  await training.train();
  steps.fail("No recordings.");
  await settled();
  assert.deepEqual(news.told, ["failed: No recordings."]);
});

test("background training: the window opened again shows it's still training", async () => {
  const { training } = background();
  await training.train();
  assert.match(await training.status(), /^Still training/);
});

test("background training: once training ends, the window shows the recordings again", async () => {
  const { training, steps } = background();
  await training.train();
  steps.finish();
  await settled();
  assert.equal(await training.status(), SAMPLES_REPLY);
});

test("background training: refused while a recording is being made", async () => {
  const { training, steps } = background();
  steps.busy = true;
  await assert.rejects(training.train(), /hasn't finished/);
});

test("background training: reports it's training until it ends", async () => {
  const { training } = background();
  await training.train();
  assert.equal(training.isTraining(), true);
});

test("background training: no longer reports training once it ends", async () => {
  const { training, steps } = background();
  await training.train();
  steps.finish();
  await settled();
  assert.equal(training.isTraining(), false);
});

test("background training: its progress says when it started", async () => {
  const { training } = background();
  await training.train();
  assert.equal(training.progressView().startedAt, STARTED_AT);
});
