import type { SessionLink } from "../../events/app-events.js";
import type { SingleVoice } from "./single-voice.js";
import type { OperatorSession } from "../model/operator-session.js";
import type { ConversationLine, ConversationLines } from "./conversation-lines.js";
import { onScreen, SCREEN_MARKER, spokenPart } from "./reply-text.js";
import type { ReplySpeaker } from "./reply-speaker.js";

/**
 * What a reply is about: the permission request it asks (its speech stops once that is answered),
 * and the worker session whose answer it relays (its lines link there).
 */
export interface ReplySubject {
  aboutRequest?: string;
  relays?: SessionLink;
  /** For a task notification: the reply speaks only if the fallback announcement hasn't. */
  voice?: SingleVoice;
}

/** Asks the model and shows its reply piece by piece as it arrives, so it is on screen before the tools finish. */
export class ReplyPresenter {
  constructor(
    private session: OperatorSession,
    private speaker: ReplySpeaker,
    private lines: ConversationLines,
  ) {}

  askShown(content: string, subject: ReplySubject = {}): Promise<string> {
    return this.session.ask(content, (text) => this.showPiece(text, subject.relays));
  }

  /**
   * Also speaks the reply piece by piece, so an acknowledgment is heard before the tools finish.
   * Each piece is shown before it is queued for speech, so the screen is never behind the voice.
   * A reply about a permission request goes quiet once that request is answered.
   */
  async askAloud(content: string, subject: ReplySubject = {}): Promise<string> {
    let spoken = Promise.resolve();
    let screenOnly = false;
    const reply = await this.session.ask(content, (text) => {
      this.showPiece(text, subject.relays);
      if (screenOnly) return;
      screenOnly = text.includes(SCREEN_MARKER);
      const aloud = spokenPart(text);
      if (aloud && (subject.voice?.replyMaySpeak() ?? true))
        spoken = spoken.then(() => this.speaker.speakWhenQuiet(aloud, subject.aboutRequest));
    });
    await spoken;
    return reply;
  }

  showLine(line: ConversationLine): void {
    this.lines.say(line);
  }

  private showPiece(text: string, relays: SessionLink | undefined): void {
    const shown = onScreen(text);
    if (shown) this.lines.say({ role: "orchestrator", text: shown, session: relays });
  }
}
