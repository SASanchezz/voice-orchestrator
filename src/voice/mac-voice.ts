import type { HotkeyTalk } from "./hotkey-talk.js";
import type { RepeatingSpeaker } from "./repeating-speaker.js";
import type { SharedMic } from "./shared-mic.js";
import type { VoiceInputState, VoiceIO } from "./voice-io.js";

/** A page's message box that follows the recording and can send your words itself. */
export interface WordsHandoff {
  /** True when a box took your words, to send them with what it already held. */
  takes(words: string): boolean;
  /** Your words went on without a box, or none were said: the box goes back to what it held. */
  passedBy(): void;
}

const NO_BOX: WordsHandoff = { takes: () => false, passedBy: () => {} };

/**
 * macOS: the shared mic, started by the hotkey, gestures, the wake word or a page's mic button; whisper.cpp for your
 * words, Kokoro or `say` for the replies. Your words go into the message box of the page you are using, which sends
 * them; with no page open, or when they only answer a permission request, they go straight on.
 */
export class MacVoice implements VoiceIO {
  private box = NO_BOX;
  private isWholeMessage: (words: string) => boolean = () => false;

  constructor(
    private mic: SharedMic,
    private speaker: Pick<RepeatingSpeaker, "speak" | "stop" | "repeatLast">,
    private hotkey: Pick<HotkeyTalk, "start">,
  ) {}

  onUtterance(cb: (text: string) => void): void {
    this.mic.on("sent", (words) => this.deliver(words, cb));
  }

  onPress(cb: () => void): void {
    this.mic.onPress(cb);
  }

  /** A recording whose words so far are a whole message, such as "allow commit", ends at once, without "finish". */
  endRecordingWhen(isWholeMessage: (words: string) => boolean): void {
    this.isWholeMessage = isWholeMessage;
    this.mic.endWhen(isWholeMessage);
  }

  /** The web UI is built after the voice, so its message boxes come later. */
  handOffTo(box: WordsHandoff): void {
    this.box = box;
  }

  isListening(): boolean {
    return this.inputState() !== "idle";
  }

  inputState(): VoiceInputState {
    return this.mic.state();
  }

  discardInput(): void {
    void this.mic.cancel();
  }

  async start(): Promise<void> {
    await this.mic.prepare();
    await this.hotkey.start();
  }

  speak(text: string): Promise<void> {
    return this.speaker.speak(text);
  }

  stopSpeaking(): void {
    this.speaker.stop();
  }

  /** Not while you talk: the mic would hear it. */
  repeatLast(): Promise<void> {
    if (this.isListening()) return Promise.resolve();
    return this.speaker.repeatLast();
  }

  private deliver(words: string, onward: (text: string) => void): void {
    const isForBox = words !== "" && !this.isWholeMessage(words);
    if (isForBox && this.box.takes(words)) return;
    this.box.passedBy();
    if (words) onward(words);
  }
}
