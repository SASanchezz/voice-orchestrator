import { test } from "node:test";
import assert from "node:assert/strict";
import { LoadingSpeaker } from "./loading-speaker.js";
import type { Speaker } from "./repeating-speaker.js";

/** A speaker that writes down what it says, and counts how often it was stopped. */
class NotingSpeaker implements Speaker {
  said: string[] = [];
  stops = 0;

  async speak(text: string): Promise<void> {
    this.said.push(text);
  }

  stop(): void {
    this.stops++;
  }
}

/** A speaker still loading until `finish` hands it over. */
class PendingLoad {
  readonly loading: Promise<Speaker>;
  private resolveLoading?: (speaker: Speaker) => void;

  constructor() {
    this.loading = new Promise((resolve) => (this.resolveLoading = resolve));
  }

  finish(speaker: Speaker): void {
    this.resolveLoading?.(speaker);
  }
}

test("loading speaker: says what was asked while loading once loaded", async () => {
  const loaded = new NotingSpeaker();
  const pending = new PendingLoad();
  const speaking = new LoadingSpeaker(pending.loading).speak("hello");
  pending.finish(loaded);
  await speaking;
  assert.deepEqual(loaded.said, ["hello"]);
});

test("loading speaker: drops what was cut off before loading finished", async () => {
  const loaded = new NotingSpeaker();
  const pending = new PendingLoad();
  const speaker = new LoadingSpeaker(pending.loading);
  const speaking = speaker.speak("old");
  speaker.stop();
  pending.finish(loaded);
  await speaking;
  assert.deepEqual(loaded.said, []);
});

test("loading speaker: stopping after loading stops the loaded speaker", async () => {
  const loaded = new NotingSpeaker();
  const speaker = new LoadingSpeaker(Promise.resolve(loaded));
  await speaker.speak("hello");
  speaker.stop();
  assert.ok(loaded.stops > 0);
});
