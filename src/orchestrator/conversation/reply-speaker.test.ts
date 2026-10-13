import { test } from "node:test";
import assert from "node:assert/strict";
import type { VoiceInputState, VoiceIO } from "../../voice/voice-io.js";
import { ReplySpeaker } from "./reply-speaker.js";

/** A speaker whose speech plays until it is stopped. */
class PlayingVoice implements VoiceIO {
  spoken: string[] = [];
  stops = 0;
  private finishPlaying = (): void => {};

  onUtterance(): void {}
  onPress(): void {}
  isListening(): boolean {
    return false;
  }
  inputState(): VoiceInputState {
    return "idle";
  }
  async start(): Promise<void> {}

  speak(text: string): Promise<void> {
    this.spoken.push(text);
    return new Promise((done) => (this.finishPlaying = done));
  }

  stopSpeaking(): void {
    this.stops++;
    this.finishPlaying();
  }
}

/** A speaker for which only `pending` requests still wait. */
function speakerWaitingFor(...pending: string[]) {
  const voice = new PlayingVoice();
  const speaker = new ReplySpeaker(voice, { isPending: (id) => pending.includes(id) });
  return { voice, speaker };
}

const settle = () => new Promise((r) => setImmediate(r));

test("reply speaker: a reply about a waiting request is spoken", async () => {
  const { voice, speaker } = speakerWaitingFor("p1");
  void speaker.speakWhenQuiet("Allow once, always or deny?", { aboutRequest: "p1" });
  await settle();
  assert.deepEqual(voice.spoken, ["Allow once, always or deny?"]);
});

test("reply speaker: a reply about an answered request is not spoken", async () => {
  const { voice, speaker } = speakerWaitingFor();
  await speaker.speakWhenQuiet("Allow once, always or deny?", { aboutRequest: "p1" });
  assert.deepEqual(voice.spoken, []);
});

test("reply speaker: answering the request cuts off its reply mid-sentence", async () => {
  const { voice, speaker } = speakerWaitingFor("p1");
  const speaking = speaker.speakWhenQuiet("Allow once, always or deny?", { aboutRequest: "p1" });
  await settle();
  speaker.answered("p1");
  await speaking;
  assert.equal(voice.stops, 1);
});

test("reply speaker: answering another request leaves the reply playing", async () => {
  const { voice, speaker } = speakerWaitingFor("p1", "p2");
  void speaker.speakWhenQuiet("Allow once, always or deny?", { aboutRequest: "p1" });
  await settle();
  speaker.answered("p2");
  assert.equal(voice.stops, 0);
});

test("reply speaker: a reply about nothing in particular is always spoken", async () => {
  const { voice, speaker } = speakerWaitingFor();
  void speaker.speakWhenQuiet("Done.");
  await settle();
  assert.deepEqual(voice.spoken, ["Done."]);
});
