import type { OperatorSession } from "../model/operator-session.js";
import type { ConversationLine, ConversationLines } from "./conversation-lines.js";
import { onScreen, SCREEN_MARKER, spokenPart } from "./reply-text.js";
import type { ReplySpeaker } from "./reply-speaker.js";

/** Asks the model and shows its reply piece by piece as it arrives, so it is on screen before the tools finish. */
export class ReplyPresenter {
  constructor(
    private session: OperatorSession,
    private speaker: ReplySpeaker,
    private lines: ConversationLines,
  ) {}

  askShown(content: string): Promise<string> {
    return this.session.ask(content, (text) => this.showPiece(text));
  }

  /**
   * Also speaks the reply piece by piece, so an acknowledgment is heard before the tools finish.
   * Each piece is shown before it is queued for speech, so the screen is never behind the voice.
   * A reply about `aboutRequest` goes quiet once that permission request is answered.
   */
  async askAloud(content: string, aboutRequest?: string): Promise<string> {
    let spoken = Promise.resolve();
    let screenOnly = false;
    const reply = await this.session.ask(content, (text) => {
      this.showPiece(text);
      if (screenOnly) return;
      screenOnly = text.includes(SCREEN_MARKER);
      const aloud = spokenPart(text);
      if (aloud) spoken = spoken.then(() => this.speaker.speakWhenQuiet(aloud, aboutRequest));
    });
    await spoken;
    return reply;
  }

  showLine(line: ConversationLine): void {
    this.lines.say(line);
  }

  private showPiece(text: string): void {
    const shown = onScreen(text);
    if (shown) this.lines.say({ role: "orchestrator", text: shown });
  }
}
