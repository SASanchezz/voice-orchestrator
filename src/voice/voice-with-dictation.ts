import type { DictationControl } from "./dictation.js";
import type { VoiceInputState, VoiceIO } from "./voice-io.js";

/**
 * Your voice, where recording with a page's mic button counts as talking too, as holding the talk key does: nothing is
 * said or put to you until you stop. Everything else is the talk key's voice as it is.
 */
export class VoiceWithDictation implements VoiceIO {
  constructor(
    private voice: VoiceIO,
    private dictation: Pick<DictationControl, "isRecording">,
  ) {}

  isListening(): boolean {
    return this.voice.isListening() || this.dictation.isRecording();
  }

  onUtterance(cb: (text: string) => void): void {
    this.voice.onUtterance(cb);
  }

  onDraft(cb: (words: string) => void): void {
    this.voice.onDraft(cb);
  }

  onPress(cb: () => void): void {
    this.voice.onPress(cb);
  }

  speak(text: string): Promise<void> {
    return this.voice.speak(text);
  }

  stopSpeaking(): void {
    this.voice.stopSpeaking();
  }

  inputState(): VoiceInputState {
    return this.voice.inputState();
  }

  discardInput(): void {
    this.voice.discardInput();
  }

  start(): Promise<void> {
    return this.voice.start();
  }
}
