/**
 * Joins recordings made in quick succession into one message. Each transcript is held for a short
 * grace period; a recording started meanwhile (even while an earlier one is still being transcribed)
 * cancels the send, and everything goes out together, in the order it was said, once you pause.
 */
export class UtteranceMerger {
  /** One entry per recording, in the order they started; undefined until its transcript arrives. */
  private transcripts: (string | undefined)[] = [];
  private sendTimer?: NodeJS.Timeout;

  constructor(
    private graceMs: number,
    private send: (message: string) => void,
  ) {}

  /** A recording started. Returns its slot, to pass to finish() with its transcript. */
  begin(): number {
    clearTimeout(this.sendTimer);
    return this.transcripts.push(undefined) - 1;
  }

  /** A recording's transcript arrived; "" for silence, an accidental tap or a failed transcription. */
  finish(slot: number, transcript: string) {
    this.transcripts[slot] = transcript.trim();
    if (this.transcripts.includes(undefined)) return; // an earlier or later recording is still on its way
    clearTimeout(this.sendTimer);
    this.sendTimer = setTimeout(() => this.sendHeld(), this.graceMs);
  }

  /** True from the first recording's start until the joined message is sent. */
  isHolding(): boolean {
    return this.transcripts.length > 0;
  }

  private sendHeld() {
    const message = this.transcripts.filter(Boolean).join(" ");
    this.transcripts = [];
    if (message) this.send(message);
  }
}
