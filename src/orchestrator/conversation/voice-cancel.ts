import type { VoiceIO } from "../../voice/voice-io.js";
import type { Input, UserInput } from "./inputs.js";
import type { VoiceHold } from "./voice-hold.js";

const DISCARDED = "Voice message discarded.";
const NOTHING_TO_DISCARD = "No voice message is left to discard; the assistant may already be answering it.";

/** The mic side: what you're saying, or your words still being transcribed. */
export type VoiceInput = Pick<VoiceIO, "inputState" | "discardInput">;

/** The operator's queue, where a spoken message waits while an earlier reply is in progress. */
export interface QueuedVoiceMessages {
  latestVoiceMessage(): UserInput | undefined;
  remove(input: Input): void;
}

/**
 * Takes back your newest voice message, wherever it waits, as long as the operator hasn't started on it.
 * Once the operator is answering, it's too late: the reply may already have sent work to a project.
 */
export class VoiceCancel {
  constructor(
    private voice: VoiceInput,
    private hold: VoiceHold,
    private queue: QueuedVoiceMessages,
  ) {}

  /** A spoken message waits behind the reply in progress, so it can still be taken back. */
  hasQueued(): boolean {
    return this.queue.latestVoiceMessage() !== undefined;
  }

  /** Newest first: what you're saying or just said, then a message waiting on a draft's files, then a queued one. */
  discardLatest(): string {
    const waiting = this.hold.waiting;
    if (this.voice.inputState() !== "idle") this.voice.discardInput();
    else if (waiting) this.hold.discard(waiting.id);
    else this.discardQueued();
    return DISCARDED;
  }

  private discardQueued(): void {
    const queued = this.queue.latestVoiceMessage();
    if (!queued) throw new Error(NOTHING_TO_DISCARD);
    this.queue.remove(queued);
  }
}
