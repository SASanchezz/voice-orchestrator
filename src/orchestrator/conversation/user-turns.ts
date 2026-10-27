import type { UserInput } from "./inputs.js";
import type { QuestionGate } from "./question-gate.js";
import type { SpeechOutput } from "./speech-output.js";
import type { UserTurnTaker } from "./turn-taker.js";

/** Your words, spoken or typed: shown, answered by the model, and spoken back only if you spoke. */
export class UserTurns {
  constructor(
    private turns: UserTurnTaker,
    private gate: QuestionGate,
    private speech: SpeechOutput,
  ) {}

  async handle(input: UserInput): Promise<void> {
    const { text, source } = input;
    this.gate.answered();
    this.turns.showLine({ role: "user", text, source });
    const aloud = this.speech.speaksReplyTo(input);
    await this.turns.take({
      message: `[USER] ${text}`,
      heard: `user: ${text}`,
      utterance: text,
      aloud,
      mentionWaiting: false,
    });
  }
}
