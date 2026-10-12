import type { SpeechMode } from "../../config/app-config.js";
import { sleep } from "../../shared/sleep.js";
import type { VoiceInputState, VoiceIO } from "../../voice/voice-io.js";
import type { EventInput, UserInput } from "./inputs.js";

const USER_DONE_POLL_MS = 200;

/** What the operator says aloud, and when: never over you, and only as much as the speech mode allows. */
export class SpeechOutput {
  constructor(
    private voice: VoiceIO,
    private mode: SpeechMode,
  ) {}

  get speechMode(): SpeechMode {
    return this.mode;
  }

  setSpeechMode(mode: SpeechMode): void {
    this.mode = mode;
    if (mode === "muted") this.voice.stopSpeaking();
  }

  /** Whether you're talking, or your words are held a moment before they're sent. */
  get voiceInput(): VoiceInputState {
    return this.voice.inputState();
  }

  isMuted(): boolean {
    return this.mode === "muted";
  }

  speaksReplyTo(input: UserInput): boolean {
    return !this.isMuted() && input.source === "voice";
  }

  speaksAbout(input: EventInput): boolean {
    if (this.isMuted()) return false;
    if (input.announcement) return true; // a task's end is always said once: the reply, or its announcement
    return this.mode === "all" || input.urgent;
  }

  async speakWhenQuiet(text: string): Promise<void> {
    await untilQuiet(this.voice);
    await this.voice.speak(text);
  }
}

/** You may have started talking meanwhile. */
export async function untilQuiet(voice: VoiceIO): Promise<void> {
  while (voice.isListening()) await sleep(USER_DONE_POLL_MS);
}
