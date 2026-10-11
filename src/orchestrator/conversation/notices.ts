import type { NoticeInput } from "./inputs.js";
import type { SpeechOutput } from "./speech-output.js";
import type { TurnContext } from "./turn-context.js";

/** Said once without a model turn; the model reads it with your next message. */
export class Notices {
  constructor(
    private speech: SpeechOutput,
    private context: TurnContext,
  ) {}

  async handle(notice: NoticeInput): Promise<void> {
    if (!this.speech.isMuted()) await this.speech.speakWhenQuiet(notice.spoken);
    this.context.addUiNote(notice.text);
  }
}
