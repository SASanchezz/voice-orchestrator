import { test } from "node:test";
import assert from "node:assert/strict";
import type { VoiceInputState, VoiceIO } from "../../voice/voice-io.js";
import { ReplySpeaker } from "./reply-speaker.js";
import { SingleVoice } from "./single-voice.js";

/** A speaker whose speech plays until it is stopped. */
class PlayingVoice implements VoiceIO {
  spoken: string[] = [];
  stops = 0;
  private finishPlaying = (): void => {};

  onUtterance(): void {}
  onDraft(): void {}
  onPress(): void {}
  isListening(): boolean {
    return false;
  }
  inputState(): VoiceInputState {
    return "idle";
  }
  discardInput(): void {}
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

test("reply speaker: silencing the latest reply cuts it off mid-sentence", async () => {
  const { voice, speaker } = speakerWaitingFor();
  const speaking = speaker.speakWhenQuiet("Say confirm push.", { voice: new SingleVoice() });
  await settle();
  speaker.silenceLatestReply();
  await speaking;
  assert.equal(voice.stops, 1);
});

test("reply speaker: the rest of a silenced reply is not said", async () => {
  const { voice, speaker } = speakerWaitingFor();
  const reply = new SingleVoice();
  const first = speaker.speakWhenQuiet("Casini GDK, right?", { voice: reply });
  await settle();
  speaker.silenceLatestReply();
  await first;
  await speaker.speakWhenQuiet("Nothing has been pushed yet.", { voice: reply });
  assert.deepEqual(voice.spoken, ["Casini GDK, right?"]);
});

test("reply speaker: a reply after the silenced one is said", async () => {
  const { voice, speaker } = speakerWaitingFor();
  const first = speaker.speakWhenQuiet("Say confirm push.", { voice: new SingleVoice() });
  await settle();
  speaker.silenceLatestReply();
  await first;
  void speaker.speakWhenQuiet("Pushed.", { voice: new SingleVoice() });
  await settle();
  assert.deepEqual(voice.spoken, ["Say confirm push.", "Pushed."]);
});
