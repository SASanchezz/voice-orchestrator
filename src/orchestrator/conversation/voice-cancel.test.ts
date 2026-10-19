import { test } from "node:test";
import assert from "node:assert/strict";
import type { VoiceInputState } from "../../voice/voice-io.js";
import type { Input, UserInput } from "./inputs.js";
import { type QueuedVoiceMessages, VoiceCancel, type VoiceInput } from "./voice-cancel.js";
import { VoiceHold } from "./voice-hold.js";

const WAIT_MS = 1000;
const QUEUED: UserInput = { kind: "user", text: "deploy webshop", source: "voice" };

/** A mic that is recording until its input is discarded. */
class FakeMic implements VoiceInput {
  constructor(private state: VoiceInputState) {}

  inputState(): VoiceInputState {
    return this.state;
  }

  discardInput(): void {
    this.state = "idle";
  }
}

class FakeQueue implements QueuedVoiceMessages {
  constructor(public inputs: Input[]) {}

  latestVoiceMessage(): UserInput | undefined {
    return this.inputs.findLast((input): input is UserInput => input.kind === "user");
  }

  remove(input: Input): void {
    this.inputs = this.inputs.filter((queued) => queued !== input);
  }
}

function heldOnDraft(): VoiceHold {
  const hold = new VoiceHold({ enqueue: () => {} }, WAIT_MS);
  hold.draftChanged("page-1", 1);
  hold.receive("look at this");
  return hold;
}

function cancelWith(mic: VoiceInputState, hold: VoiceHold, queued: Input[]) {
  const voice = new FakeMic(mic);
  const queue = new FakeQueue(queued);
  return { cancel: new VoiceCancel(voice, hold, queue), voice, hold, queue };
}

test("voice cancel: while you talk, your recording is discarded", () => {
  const { cancel, voice } = cancelWith("recording", heldOnDraft(), [QUEUED]);
  cancel.discardLatest();
  assert.equal(voice.inputState(), "idle");
});

test("voice cancel: while you talk, an older waiting message is kept", () => {
  const { cancel, hold } = cancelWith("held", heldOnDraft(), []);
  cancel.discardLatest();
  assert.equal(hold.waiting?.text, "look at this");
});

test("voice cancel: a message waiting on a draft's files is discarded before a queued one", () => {
  const { cancel, hold, queue } = cancelWith("idle", heldOnDraft(), [QUEUED]);
  cancel.discardLatest();
  assert.deepEqual([hold.waiting, queue.inputs], [undefined, [QUEUED]]);
});

test("voice cancel: a message queued behind a reply in progress is taken off the queue", () => {
  const notice: Input = { kind: "notice", text: "done", spoken: "done" };
  const { cancel, queue } = cancelWith("idle", new VoiceHold({ enqueue: () => {} }, WAIT_MS), [QUEUED, notice]);
  cancel.discardLatest();
  assert.deepEqual(queue.inputs, [notice]);
});

test("voice cancel: a queued voice message can still be taken back", () => {
  const { cancel } = cancelWith("idle", new VoiceHold({ enqueue: () => {} }, WAIT_MS), [QUEUED]);
  assert.equal(cancel.hasQueued(), true);
});

test("voice cancel: with nothing left before the reply, discarding is refused", () => {
  const { cancel } = cancelWith("idle", new VoiceHold({ enqueue: () => {} }, WAIT_MS), []);
  assert.throws(() => cancel.discardLatest(), /already be answering/);
});
