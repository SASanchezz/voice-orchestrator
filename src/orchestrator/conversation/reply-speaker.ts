import type { WaitingRequests } from "../../permissions/waiting-requests.js";
import type { VoiceIO } from "../../voice/voice-io.js";
import { untilQuiet } from "./speech-output.js";

/**
 * Speaks the model's replies once you're quiet. A reply about a permission request is never said
 * after the request is answered (by voice, click or pop-up), and is cut off if it is playing then.
 */
export class ReplySpeaker {
  private speakingAbout?: string;

  constructor(
    private voice: VoiceIO,
    private waiting: Pick<WaitingRequests, "isPending">,
  ) {}

  async speakWhenQuiet(text: string, aboutRequest?: string): Promise<void> {
    await untilQuiet(this.voice);
    if (aboutRequest && !this.waiting.isPending(aboutRequest)) return;
    this.speakingAbout = aboutRequest;
    await this.voice.speak(text);
    if (this.speakingAbout === aboutRequest) this.speakingAbout = undefined;
  }

  /** The request no longer waits: stop saying it. */
  answered(requestId: string): void {
    if (this.speakingAbout === requestId) this.voice.stopSpeaking();
  }
}
