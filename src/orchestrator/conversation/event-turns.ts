import type { EventInput } from "./inputs.js";
import type { QuestionGate } from "./question-gate.js";
import { SingleVoice } from "./single-voice.js";
import type { SpeechOutput } from "./speech-output.js";
import type { Turn, TurnTaker } from "./turn-taker.js";

/** How long the model's reply may take to start speaking before the short announcement is said instead. */
export const REPLY_WAIT_MS = 8000;

/**
 * A notification, put to the model; a spoken one waits for your answer.
 * A finished or failed task is spoken once: the model's reply, or its short announcement if the model
 * is slow, fails, or says nothing aloud.
 */
export class EventTurns {
  constructor(
    private turns: Pick<TurnTaker, "take">,
    private gate: Pick<QuestionGate, "isAlreadyAnswered" | "askedAbout">,
    private speech: Pick<SpeechOutput, "speaksAbout" | "speakWhenQuiet">,
  ) {}

  async handle(input: EventInput): Promise<void> {
    if (this.gate.isAlreadyAnswered(input)) return;
    const aloud = this.speech.speaksAbout(input);
    const voice = new SingleVoice();
    const turn: Turn = {
      message: input.text,
      heard: input.text,
      aloud,
      aboutRequest: input.permissionId,
      relays: input.session,
      voice,
      mentionWaiting: true,
    };
    if (aloud && input.announcement) await this.takeWithFallback(turn, voice, input.announcement);
    else await this.turns.take(turn);
    if (aloud && voice.hasSpoken()) this.gate.askedAbout(input);
  }

  /** The announcement is said if the reply hasn't started speaking in time, or ends without a spoken part. */
  private async takeWithFallback(turn: Turn, voice: SingleVoice, announcement: string): Promise<void> {
    const sayAnnouncement = () =>
      voice.claimForFallback() ? this.speech.speakWhenQuiet(announcement) : Promise.resolve();
    let late = Promise.resolve();
    const timer = setTimeout(() => {
      late = sayAnnouncement();
    }, REPLY_WAIT_MS);
    try {
      await this.turns.take(turn);
    } finally {
      clearTimeout(timer);
      await late;
      await sayAnnouncement();
    }
  }
}
