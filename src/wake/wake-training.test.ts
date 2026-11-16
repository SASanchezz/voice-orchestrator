import { test } from "node:test";
import assert from "node:assert/strict";
import type { WakeRecordingView } from "../ui/wake-recording-views.js";
import type { RecordingLabel } from "./training-command.js";
import type { RecordingRef } from "./wake-recordings.js";
import type { SamplesEvent, TrainedEvent, TriedEvent } from "./training-event.js";
import type { WakeWordState } from "./wake-switch.js";
import { UnavailableWakeTraining, WakeTraining } from "./wake-training.js";

const TAKE: RecordingRef = { label: "wake", name: "take.wav" };
const OTHER_TAKE: RecordingRef = { label: "other", name: "talk.wav" };
const SAMPLES: SamplesEvent = { type: "samples", wake: 3, other: 1, trained: false };
const TRAINED: TrainedEvent = {
  type: "trained",
  model: "hey_oracle",
  caught: 1,
  checked_wake: 1,
  false_wakes: 0,
  checked_other: 0,
  quiet_false_wakes: 0,
  checked_quiet: 1,
};

/** Stands in for `python -m wake`; a recording can be held open until `finish` is called. */
class FakeSteps {
  recorded: RecordingLabel[] = [];
  private finishRecording?: () => void;

  samples(): Promise<SamplesEvent> {
    return Promise.resolve(SAMPLES);
  }

  async record(label: RecordingLabel): Promise<SamplesEvent> {
    this.recorded.push(label);
    await new Promise<void>((resolve) => (this.finishRecording = resolve));
    return SAMPLES;
  }

  train(): Promise<TrainedEvent> {
    return Promise.resolve(TRAINED);
  }

  tryOut(): Promise<TriedEvent> {
    return Promise.reject(new Error("There is no trained model to try yet: record yourself, then train."));
  }

  finish(): void {
    this.finishRecording?.();
  }
}

/** Stands in for the wake word switch; writes down when the listener was paused and started again. */
class FakeListener {
  done: string[] = [];
  state: WakeWordState = "on";

  async pausedDuring<Result>(work: () => Promise<Result>): Promise<Result> {
    this.done.push("paused");
    try {
      return await work();
    } finally {
      this.done.push("resumed");
    }
  }
}

/** Stands in for your recordings on disk; writes down which were deleted. */
class FakeRecordings {
  deleted: string[] = [];

  list(): WakeRecordingView[] {
    return [];
  }

  pathOf(label: RecordingLabel, name: string): string {
    return `${label}/${name}`;
  }

  deleteAll(recordings: RecordingRef[]): void {
    this.deleted.push(...recordings.map(({ label, name }) => `${label}/${name}`));
  }
}

interface TrainingParts {
  wakeTraining: WakeTraining;
  steps: FakeSteps;
  listener: FakeListener;
  recordings: FakeRecordings;
}

function training(): TrainingParts {
  const steps = new FakeSteps();
  const listener = new FakeListener();
  const recordings = new FakeRecordings();
  return { wakeTraining: new WakeTraining(steps, listener, recordings), steps, listener, recordings };
}

test("wake training: a recording is made with the listener paused", async () => {
  const { wakeTraining, steps, listener } = training();
  const recording = wakeTraining.record("wake");
  steps.finish();
  await recording;
  assert.deepEqual(listener.done, ["paused", "resumed"]);
});

test("wake training: a second recording while one runs is refused", async () => {
  const { wakeTraining, steps } = training();
  const first = wakeTraining.record("wake");
  await assert.rejects(wakeTraining.record("other"), /hasn't finished/);
  steps.finish();
  await first;
});

test("wake training: once a recording finishes, the next one can start", async () => {
  const { wakeTraining, steps } = training();
  const first = wakeTraining.record("wake");
  steps.finish();
  await first;
  const second = wakeTraining.record("other");
  steps.finish();
  await second;
  assert.deepEqual(steps.recorded, ["wake", "other"]);
});

test("wake training: training answers with how the model did", async () => {
  assert.match(await training().wakeTraining.train(), /^Trained\. /);
});

test("wake training: a step that fails says why", async () => {
  await assert.rejects(training().wakeTraining.tryOut(), /no trained model to try yet/);
});

test("wake training: after a failed step, the next one can start", async () => {
  const { wakeTraining } = training();
  await assert.rejects(wakeTraining.tryOut());
  assert.match(await wakeTraining.train(), /^Trained\. /);
});

test("wake training: deleting recordings removes their files", async () => {
  const { wakeTraining, recordings } = training();
  await wakeTraining.deleteRecordings([TAKE, OTHER_TAKE]);
  assert.deepEqual(recordings.deleted, ["wake/take.wav", "other/talk.wav"]);
});

test("wake training: deleting recordings answers with how many, and the recordings left", async () => {
  const reply = await training().wakeTraining.deleteRecordings([TAKE, OTHER_TAKE]);
  assert.match(reply, /^Deleted 2 recordings\. "Hey Oracle" recorded 3 times/);
});

test("wake training: deleting one recording says so in the singular", async () => {
  assert.match(await training().wakeTraining.deleteRecordings([TAKE]), /^Deleted 1 recording\. /);
});

test("wake training: deleting recordings leaves the listener running", async () => {
  const { wakeTraining, listener } = training();
  await wakeTraining.deleteRecordings([TAKE]);
  assert.deepEqual(listener.done, []);
});

test("wake training: recordings can't be deleted while one is being made", async () => {
  const { wakeTraining, steps } = training();
  const recording = wakeTraining.record("wake");
  await assert.rejects(wakeTraining.deleteRecordings([TAKE]), /hasn't finished/);
  steps.finish();
  await recording;
});

test("wake training: unavailable, every step says why", async () => {
  await assert.rejects(new UnavailableWakeTraining("No mic here.").train(), /^Error: No mic here\.$/);
});
