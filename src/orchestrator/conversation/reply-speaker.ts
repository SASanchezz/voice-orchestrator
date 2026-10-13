import type { WaitingRequests } from "../../permissions/waiting-requests.js";
import type { VoiceIO } from "../../voice/voice-io.js";
import type { SingleVoice } from "./single-voice.js";
import { untilQuiet } from "./speech-output.js";

/** What a spoken reply is about, which may make it go quiet. */
export interface SpokenSubject {
  /** The permission request it asks: its speech stops once that is answered. */
  aboutRequest?: string;
  /** For a task notification: the reply speaks only if the fallback announcement hasn't, and its pop-up wasn't clicked. */
  voice?: SingleVoice;
}

/**
 * Speaks the model's replies once you're quiet. A reply about a permission request is never said
 * after the request is answered (by voice, click or pop-up), and is cut off if it is playing then.
 * Neither is a reply about a task whose pop-up you clicked.
 */
export class ReplySpeaker {
  private speakingAbout?: string;

  constructor(
    private voice: VoiceIO,
    private waiting: Pick<WaitingRequests, "isPending">,
  ) {}

  async speakWhenQuiet(text: string, { aboutRequest, voice }: SpokenSubject = {}): Promise<void> {
    await untilQuiet(this.voice);
    if (aboutRequest && !this.waiting.isPending(aboutRequest)) return;
    if (voice?.isSilenced()) return;
    this.speakingAbout = aboutRequest;
    await this.voice.speak(text);
    if (this.speakingAbout === aboutRequest) this.speakingAbout = undefined;
  }

  /** The request no longer waits: stop saying it. */
  answered(requestId: string): void {
    if (this.speakingAbout === requestId) this.voice.stopSpeaking();
  }
}
