/**
 * One spoken message per task notification: the model's reply, or else the short announcement.
 * Whichever starts first keeps the voice; the other stays on screen only.
 * Clicking its pop-up silences it for good: whatever is playing stops, as with the talk key, and nothing more is said.
 */
export class SingleVoice {
  private owner?: "reply" | "fallback";
  private silenced = false;

  constructor(private stopSpeaking: () => void = () => {}) {}

  /** The reply may speak if it is first, or already speaking. */
  replyMaySpeak(): boolean {
    if (this.silenced) return false;
    this.owner ??= "reply";
    return this.owner === "reply";
  }

  /** True once, and only if nothing has been said yet. */
  claimForFallback(): boolean {
    if (this.owner || this.silenced) return false;
    this.owner = "fallback";
    return true;
  }

  hasSpoken(): boolean {
    return this.owner !== undefined;
  }

  isSilenced(): boolean {
    return this.silenced;
  }

  silence(): void {
    this.silenced = true;
    this.stopSpeaking();
  }
}
