import type { EventInput } from "./inputs.js";
import type { QuestionGate } from "./question-gate.js";
import type { SpeechOutput } from "./speech-output.js";
import type { TurnTaker } from "./turn-taker.js";

/** A notification: announced if it ends a task, then put to the model; a spoken one waits for your answer. */
export class EventTurns {
  constructor(
    private turns: TurnTaker,
    private gate: QuestionGate,
    private speech: SpeechOutput,
  ) {}

  async handle(input: EventInput): Promise<void> {
    if (this.gate.isAlreadyAnswered(input)) return;
    if (input.announcement) await this.announce(input, input.announcement);
    const aloud = this.speech.speaksAbout(input);
    const turn = {
      message: input.text,
      heard: input.text,
      aloud,
      aboutRequest: input.permissionId,
      relays: input.session,
      mentionWaiting: true,
    };
    const reply = await this.turns.take(turn);
    if (reply && aloud) this.gate.askedAbout(input);
  }

  /** A task's short spoken outcome, said before the model's turn so it isn't held up by it. */
  private async announce(input: EventInput, announcement: string): Promise<void> {
    if (this.speech.isMuted()) return;
    await this.speech.speakWhenQuiet(announcement);
    this.gate.askedAbout(input);
  }
}
