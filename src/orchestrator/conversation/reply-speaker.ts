import type { WaitingRequests } from "../../permissions/waiting-requests.js";
import { untilQuiet } from "../../voice/until-quiet.js";
import type { VoiceIO } from "../../voice/voice-io.js";
import type { SingleVoice } from "./single-voice.js";

/** What a spoken reply is about, which may make it go quiet. */
export interface SpokenSubject {
  /** The permission request it asks: its speech stops once that is answered. */
  aboutRequest?: string;
  /**
   * The reply's one voice: once it is silenced, nothing more of the reply is said. For a task notification,
   * the reply speaks only if the fallback announcement hasn't, and its pop-up wasn't clicked.
   */
  voice?: SingleVoice;
}

/**
 * Speaks the model's replies once you're quiet. A reply about a permission request is never said
 * after the request is answered (by voice, click or pop-up), and is cut off if it is playing then.
 * Neither is a reply about a task whose pop-up you clicked, nor the rest of a reply you silenced.
 */
export class ReplySpeaker {
  private speakingAbout?: string;
  private latestVoice?: SingleVoice;

  constructor(
    private voice: VoiceIO,
    private waiting: Pick<WaitingRequests, "isPending">,
  ) {}

  async speakWhenQuiet(text: string, { aboutRequest, voice }: SpokenSubject = {}): Promise<void> {
    this.latestVoice = voice;
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

  /** Cuts off the reply being said, as the talk key does, and leaves the rest of that reply unsaid. */
  silenceLatestReply(): void {
    this.latestVoice?.silence();
    this.voice.stopSpeaking();
  }
}
