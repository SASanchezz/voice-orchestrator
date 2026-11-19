import { normalizeSpeech } from "../../safety/confirm-phrase.js";
import { errorMessage } from "../../shared/errors.js";
import type { VoiceApprovals } from "../../voice/approval-voice.js";
import type { Draft } from "./draft-store.js";

/** The only words that send a reply by voice; a "yes" or "send it" inside a sentence never does. */
const CONFIRM_SEND = "confirm send";
/** How long a draft stays ready for "confirm send" after the page marks it. */
export const ARMED_FOR_MS = 120_000;
const NOTHING_ARMED = 'No reply is waiting for "confirm send". Open its draft first.';

/** What sends: the desk, which checks the draft is still waiting and sends exactly the given text. */
export interface ReplySending {
  send(id: string, approvedText: string): Promise<Draft>;
}

interface ArmedDraft {
  id: string;
  text: string;
  until: number;
}

/**
 * "confirm send", said as a whole message, sends the one draft the page marked as in front of you, with exactly the
 * text it showed. Matched in code, before any model sees your words, like "allow" for a permission request.
 */
export class SpokenSend implements VoiceApprovals {
  private armed?: ArmedDraft;

  constructor(
    private sending: ReplySending,
    private speak: (text: string) => void,
    private now: () => number = Date.now,
  ) {}

  /** The page calls this with the draft in front of you and its text, each time either changes; it replaces any other. */
  arm(id: string, text: string): void {
    this.armed = { id, text, until: this.now() + ARMED_FOR_MS };
  }

  disarm(id: string): void {
    if (this.armed?.id === id) this.armed = undefined;
  }

  canAnswer(words: string): boolean {
    return normalizeSpeech(words) === CONFIRM_SEND;
  }

  answer(words: string): string {
    const armed = this.armed;
    this.armed = undefined;
    if (!this.canAnswer(words) || !armed || armed.until < this.now()) return NOTHING_ARMED;
    void this.sendOrSay(armed);
    return "Sending.";
  }

  private async sendOrSay({ id, text }: ArmedDraft): Promise<void> {
    try {
      const sent = await this.sending.send(id, text);
      this.speak(`Sent to ${sent.chatName}.`);
    } catch (error) {
      this.speak(`Not sent: ${errorMessage(error)}`);
    }
  }
}
