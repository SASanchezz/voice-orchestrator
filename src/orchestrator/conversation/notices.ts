import type { NoticeInput } from "./inputs.js";
import type { SpeechOutput } from "./speech-output.js";
import type { TurnContext } from "./turn-context.js";

/** Said once without a model turn; the model reads it with your next message. */
export class Notices {
  constructor(
    private speech: SpeechOutput,
    private context: TurnContext,
  ) {}

  /** A notice with nothing to say is only noted. */
  async handle(notice: NoticeInput): Promise<void> {
    const isSpoken = notice.spoken !== "" && !this.speech.isMuted();
    if (isSpoken) await this.speech.speakWhenQuiet(notice.spoken, notice.voice);
    this.context.addUiNote(notice.text);
  }
}
