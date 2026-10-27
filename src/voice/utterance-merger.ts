/** One recording's place in the message being held. */
export type UtteranceSlot = symbol;

/**
 * Joins recordings that overlap into one message: a recording started while an earlier one is still being
 * transcribed waits for it, and everything goes out together, in the order it was said, once the last
 * transcript arrives. Nothing waits after that.
 */
export class UtteranceMerger {
  /** One entry per recording, in the order they started; undefined until its transcript arrives. */
  private transcripts = new Map<UtteranceSlot, string | undefined>();

  constructor(private send: (message: string) => void) {}

  /** A recording started. Returns its slot, to pass to finish() with its transcript. */
  begin(): UtteranceSlot {
    const slot = Symbol("utterance");
    this.transcripts.set(slot, undefined);
    return slot;
  }

  /** A recording's transcript arrived; "" for silence, an accidental tap or a failed transcription. */
  finish(slot: UtteranceSlot, transcript: string): void {
    if (!this.transcripts.has(slot)) return; // discarded while it was transcribed
    this.transcripts.set(slot, transcript.trim());
    if ([...this.transcripts.values()].includes(undefined)) return; // an earlier or later recording is still on its way
    this.sendHeld();
  }

  /** Drops the whole message being held, including recordings still being transcribed; nothing is sent. */
  discard(): void {
    this.transcripts.clear();
  }

  /** True from the first recording's start until the joined message is sent. */
  isHolding(): boolean {
    return this.transcripts.size > 0;
  }

  private sendHeld(): void {
    const message = [...this.transcripts.values()].filter(Boolean).join(" ");
    this.transcripts.clear();
    if (message) this.send(message);
  }
}
