import { ForwardingVoice } from "./forwarding-voice.js";
import type { VoiceIO } from "./voice-io.js";
import type { SessionInFront } from "./worker-voice.js";

/** Answers a waiting permission request from a message that is nothing but an approval. */
export interface VoiceApprovals {
  canAnswer(words: string): boolean;
  /** Answers it and returns what to say back. */
  answer(words: string, sessionInFront: string | undefined): string;
}

/**
 * Your voice, where a message that is only an approval ("allow", "deny", "allow commit") answers the waiting request
 * at once, on any tab, and goes nowhere else: not into a worker's chat, nor to the assistant. Its requests in the
 * session in front come first.
 */
export class ApprovalVoice extends ForwardingVoice {
  /** The session in front when you started talking. */
  private sessionInFront?: string;

  constructor(
    voice: VoiceIO,
    private front: SessionInFront,
    private approvals: VoiceApprovals,
  ) {
    super(voice);
  }

  onPress(cb: () => void): void {
    this.voice.onPress(() => {
      this.sessionInFront = this.front.hasSession() ? this.front.session() : undefined;
      cb();
    });
  }

  onUtterance(onward: (text: string) => void): void {
    this.voice.onUtterance((text) => this.deliver(text, onward));
  }

  private deliver(text: string, onward: (text: string) => void): void {
    if (!this.approvals.canAnswer(text)) return onward(text);
    const reply = this.approvals.answer(text, this.sessionInFront);
    console.log(`[voice] "${text}": ${reply}`);
    void this.voice.speak(reply);
  }
}
