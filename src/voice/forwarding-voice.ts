import type { VoiceInputState, VoiceIO } from "./voice-io.js";

/** A voice that passes everything to the one it wraps; subclasses change only what they are about. */
export abstract class ForwardingVoice implements VoiceIO {
  constructor(protected voice: VoiceIO) {}

  onUtterance(cb: (text: string) => void): void {
    this.voice.onUtterance(cb);
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

  isListening(): boolean {
    return this.voice.isListening();
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
