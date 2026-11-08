import type { ReplySpeaker } from "./reply-speaker.js";

/** Where the words go once said: in as if you had typed them. */
export interface TypedInput {
  receiveTyped(text: string): void;
}

/**
 * The words a Confirm or Cancel click says for you. Like pressing the talk key, the click cuts off the reply being
 * said, and the rest of that reply stays unsaid, so you don't hear it ask for what you just answered.
 */
export class ClickedWords {
  constructor(
    private replies: Pick<ReplySpeaker, "silenceLatestReply">,
    private input: TypedInput,
  ) {}

  receiveTyped(text: string): void {
    this.replies.silenceLatestReply();
    this.input.receiveTyped(text);
  }
}
