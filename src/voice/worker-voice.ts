import { errorMessage } from "../shared/errors.js";
import type { VoiceInputState, VoiceIO } from "./voice-io.js";

/** The worker session of the project tab you are using, if any. */
export interface SessionInFront {
  hasSession(): boolean;
  session(): string;
}

/** Sends your words to a session's worker as a task, as the message box's Send does. */
export type SendToWorker = (session: string, text: string) => void;

/**
 * Your voice, where a message started while a project tab is in front goes straight to that tab's worker instead of
 * to the assistant. With the assistant's tab open, or another app in front, it goes to the assistant as before.
 */
export class WorkerVoice implements VoiceIO {
  /** The session in front when you started talking; unset, your words go to the assistant. */
  private worker?: string;

  constructor(
    private voice: VoiceIO,
    private front: SessionInFront,
    private sendToWorker: SendToWorker,
  ) {}

  /** Where your words go is settled the moment you start talking, not when they are transcribed. */
  onPress(cb: () => void): void {
    this.voice.onPress(() => {
      this.worker = this.front.hasSession() ? this.front.session() : undefined;
      cb();
    });
  }

  onUtterance(toAssistant: (text: string) => void): void {
    this.voice.onUtterance((text) => this.deliver(text, toAssistant));
  }

  onDraft(cb: (words: string) => void): void {
    this.voice.onDraft(cb);
  }

  isListening(): boolean {
    return this.voice.isListening();
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

  private deliver(text: string, toAssistant: (text: string) => void): void {
    if (this.worker === undefined) return toAssistant(text);
    this.sendOrLog(this.worker, text);
  }

  /** A session closed while you talked can't take it; your words are logged rather than lost silently. */
  private sendOrLog(session: string, text: string): void {
    try {
      this.sendToWorker(session, text);
    } catch (error) {
      console.error(`[voice] couldn't send "${text}" to session ${session}: ${errorMessage(error)}`);
    }
  }
}
