import { EventEmitter } from "node:events";
import { errorMessage } from "../shared/errors.js";
import { DISCARD_SOUND, END_SOUND, START_SOUND } from "./sounds.js";
import { endsWithStopPhrase, spokenRequest } from "./spoken-request.js";
import type { VoiceInputState } from "./voice-io.js";

/** What starts a recording: the talk key, a talk gesture, the wake word, or a page's mic button. */
export type TalkSource = "hotkey" | "gesture" | "wake" | "button";

/** What goes with a recording besides the mic: the reply being said stops, and sounds mark its start and end. */
export interface MicCues {
  stopSpeaking(): void;
  play(sound: string): void;
}

/** The recording engine: see DictationControl. */
interface Recorder {
  prepare(): Promise<void>;
  start(): string;
  finish(): Promise<string>;
  cancel(): Promise<string>;
  on(event: "words", listener: (words: string) => void): unknown;
  on(event: "limit", listener: () => void): unknown;
}

/** "sent" brings your words, or "" when nothing was said; "kept" the words of one stopped at its limit. */
interface MicEvents {
  started: [];
  words: [string];
  sent: [string];
  kept: [string];
  cancelled: [];
}

const NOT_RECORDING = "The mic isn't recording.";

/**
 * The one mic, shared by the talk key, the talk gestures, the wake word and the pages' mic buttons: one recording at
 * a time, whatever started it. Sending ends it and passes your words on; keeping ends it for a message box to edit.
 * Saying "finish" at the end sends it, and so does a message that is whole on its own, such as "allow commit".
 */
export class SharedMic extends EventEmitter<MicEvents> {
  private holder?: TalkSource;
  private finishing = 0;
  private pressed: () => void = () => {};
  private isWholeMessage: (words: string) => boolean = () => false;

  constructor(
    private recorder: Recorder,
    private cues: MicCues,
  ) {
    super();
    recorder.on("words", (words) => this.heard(words));
    recorder.on("limit", () => void this.keepAtLimit());
  }

  prepare(): Promise<void> {
    return this.recorder.prepare();
  }

  /** Fires the moment you start talking, before your words are known. */
  onPress(cb: () => void): void {
    this.pressed = cb;
  }

  endWhen(isWholeMessage: (words: string) => boolean): void {
    this.isWholeMessage = isWholeMessage;
  }

  /** Ignored while a recording goes on; throws when there is no mic. */
  start(source: TalkSource): void {
    if (this.holder) return;
    this.recorder.start();
    this.holder = source;
    this.cues.stopSpeaking(); // starting to talk interrupts the reply mid-sentence
    this.pressed();
    this.cues.play(START_SOUND);
    this.emit("started");
  }

  /** Only the source that started the recording ends it this way. */
  release(source: TalkSource): void {
    if (this.isRecordingFor(source)) void this.send();
  }

  async send(): Promise<void> {
    if (!this.holder) return;
    try {
      this.emit("sent", await this.finish());
    } catch (error) {
      console.error(`[voice] couldn't finish the recording: ${errorMessage(error)}`);
    }
  }

  /** Your words for a message box to edit, or "" when nothing was said. */
  keep(): Promise<string> {
    if (!this.holder) return Promise.reject(new Error(NOT_RECORDING));
    return this.finish();
  }

  /** Drops the recording unheard, whatever started it; with none going, there is nothing to drop. */
  async cancel(): Promise<void> {
    if (!this.holder) return;
    this.holder = undefined;
    this.cues.play(DISCARD_SOUND);
    this.emit("cancelled");
    await this.recorder.cancel();
  }

  /** Held while the end of a recording is transcribed. */
  state(): VoiceInputState {
    if (this.holder) return "recording";
    return this.finishing ? "held" : "idle";
  }

  private isRecordingFor(source: TalkSource): boolean {
    return this.holder === source;
  }

  private heard(words: string): void {
    this.emit("words", words);
    const isDone = endsWithStopPhrase(words) || this.isWholeMessage(words);
    if (isDone) void this.send();
  }

  /** Safety net when nothing ends it: the mic goes off and your words wait in the box. */
  private async keepAtLimit(): Promise<void> {
    if (this.holder) this.emit("kept", await this.finish());
  }

  private async finish(): Promise<string> {
    this.holder = undefined;
    this.finishing++;
    this.cues.play(END_SOUND);
    try {
      return spokenRequest(await this.recorder.finish());
    } finally {
      this.finishing--;
    }
  }
}
