import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter, once } from "node:events";
import { SharedMic } from "./shared-mic.js";
import { DISCARD_SOUND, START_SOUND } from "./sounds.js";

const WORDS = "add a dark mode toggle";

/** Stands in for the recording engine; it hears `words` at the end and writes down what it was asked to do. */
class FakeRecorder extends EventEmitter {
  done: string[] = [];
  words = WORDS;

  prepare(): Promise<void> {
    return Promise.resolve();
  }

  start(): string {
    this.done.push("start");
    return "Listening…";
  }

  finish(): Promise<string> {
    this.done.push("finish");
    return Promise.resolve(this.words);
  }

  cancel(): Promise<string> {
    this.done.push("cancel");
    return Promise.resolve("Recording discarded.");
  }
}

function sharedMic(): { mic: SharedMic; recorder: FakeRecorder; cues: string[] } {
  const recorder = new FakeRecorder();
  const cues: string[] = [];
  const mic = new SharedMic(recorder, {
    stopSpeaking: () => cues.push("stop speaking"),
    play: (sound) => cues.push(sound),
  });
  return { mic, recorder, cues };
}

function recordingMic(): ReturnType<typeof sharedMic> {
  const parts = sharedMic();
  parts.mic.start("hotkey");
  return parts;
}

test("shared mic: starting records and says so", () => {
  const { mic } = recordingMic();
  assert.equal(mic.state(), "recording");
});

test("shared mic: starting cuts off the reply being said, then plays the start sound", () => {
  const { cues } = recordingMic();
  assert.deepEqual(cues, ["stop speaking", START_SOUND]);
});

test("shared mic: a second start while recording is ignored", () => {
  const { mic, recorder } = recordingMic();
  mic.start("wake");
  assert.deepEqual(recorder.done, ["start"]);
});

test("shared mic: a mic that can't start leaves it idle", () => {
  const { mic, recorder } = sharedMic();
  recorder.start = () => {
    throw new Error("There is no mic in text mode.");
  };
  assert.throws(() => mic.start("button"), /no mic/);
  assert.equal(mic.state(), "idle");
});

test("shared mic: sending passes your words on", async () => {
  const { mic } = recordingMic();
  const sent = once(mic, "sent");
  await mic.send();
  assert.deepEqual(await sent, [WORDS]);
});

test("shared mic: sending leaves out the stop phrase", async () => {
  const { mic, recorder } = recordingMic();
  recorder.words = `${WORDS} finish`;
  const sent = once(mic, "sent");
  await mic.send();
  assert.deepEqual(await sent, [WORDS]);
});

test("shared mic: sending with nothing said passes on no words", async () => {
  const { mic, recorder } = recordingMic();
  recorder.words = "";
  const sent = once(mic, "sent");
  await mic.send();
  assert.deepEqual(await sent, [""]);
});

test("shared mic: sending without a recording does nothing", async () => {
  const { mic, recorder } = sharedMic();
  await mic.send();
  assert.deepEqual(recorder.done, []);
});

test("shared mic: keeping gives your words back for the box", async () => {
  const { mic } = recordingMic();
  assert.equal(await mic.keep(), WORDS);
});

test("shared mic: keeping without a recording is an error", async () => {
  const { mic } = sharedMic();
  await assert.rejects(mic.keep(), /isn't recording/);
});

test("shared mic: it is held while the end is transcribed", () => {
  const { mic } = recordingMic();
  void mic.send();
  assert.equal(mic.state(), "held");
});

test("shared mic: saying finish at the end sends the recording", async () => {
  const { mic, recorder } = recordingMic();
  const sent = once(mic, "sent");
  recorder.emit("words", `${WORDS} finish`);
  assert.deepEqual(await sent, [WORDS]);
});

test("shared mic: a whole message sends the recording without finish", async () => {
  const { mic, recorder } = recordingMic();
  mic.endWhen((words) => words === "allow");
  recorder.words = "allow";
  const sent = once(mic, "sent");
  recorder.emit("words", "allow");
  assert.deepEqual(await sent, ["allow"]);
});

test("shared mic: your words so far are passed on", async () => {
  const { mic, recorder } = recordingMic();
  const words = once(mic, "words");
  recorder.emit("words", "add a dark");
  assert.deepEqual(await words, ["add a dark"]);
});

test("shared mic: only the source that started it ends it by releasing", () => {
  const { mic } = recordingMic();
  mic.release("gesture");
  assert.equal(mic.state(), "recording");
});

test("shared mic: the source that started it ends it by releasing", () => {
  const { mic } = recordingMic();
  mic.release("hotkey");
  assert.notEqual(mic.state(), "recording");
});

test("shared mic: cancelling drops the recording unheard", async () => {
  const { mic, recorder } = recordingMic();
  await mic.cancel();
  assert.deepEqual(recorder.done, ["start", "cancel"]);
});

test("shared mic: cancelling plays the discard sound", async () => {
  const { mic, cues } = recordingMic();
  await mic.cancel();
  assert.equal(cues.at(-1), DISCARD_SOUND);
});

test("shared mic: cancelling with no recording does nothing", async () => {
  const { mic, recorder } = sharedMic();
  await mic.cancel();
  assert.deepEqual(recorder.done, []);
});

test("shared mic: a recording at its limit is kept, not sent", async () => {
  const { mic, recorder } = recordingMic();
  const kept = once(mic, "kept");
  recorder.emit("limit");
  assert.deepEqual(await kept, [WORDS]);
});

test("shared mic: you are told the moment you start talking", () => {
  const { mic } = sharedMic();
  let pressed = false;
  mic.onPress(() => (pressed = true));
  mic.start("wake");
  assert.equal(pressed, true);
});
