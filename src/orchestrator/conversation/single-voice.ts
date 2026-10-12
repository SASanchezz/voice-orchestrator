/**
 * One spoken message per task notification: the model's reply, or else the short announcement.
 * Whichever starts first keeps the voice; the other stays on screen only.
 */
export class SingleVoice {
  private owner?: "reply" | "fallback";

  /** The reply may speak if it is first, or already speaking. */
  replyMaySpeak(): boolean {
    this.owner ??= "reply";
    return this.owner === "reply";
  }

  /** True once, and only if nothing has been said yet. */
  claimForFallback(): boolean {
    if (this.owner) return false;
    this.owner = "fallback";
    return true;
  }

  hasSpoken(): boolean {
    return this.owner !== undefined;
  }
}
