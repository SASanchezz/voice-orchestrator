import type { ConversationLine } from "../../orchestrator/conversation/conversation-lines.js";

/**
 * Whether the assistant's words in this turn answer you (you spoke or typed in it, rather than a notification starting
 * it), and whether its answer already brought the pop-up up.
 */
export class TurnAnswer {
  private asked = false;
  private broughtUp = false;

  heard({ role }: ConversationLine): void {
    if (role === "user") this.asked = true;
  }

  /** Your words, and the assistant's in a turn you started. */
  isForYou({ role }: ConversationLine): boolean {
    return role === "user" || this.asked;
  }

  /** The assistant's first words to you in this turn: shown before they are spoken, so the pop-up comes up with them. */
  startsAnswer({ role }: ConversationLine): boolean {
    return role === "orchestrator" && this.asked && !this.broughtUp;
  }

  markBroughtUp(): void {
    this.broughtUp = true;
  }

  /** The turn ended; the next one answers you only once you speak or type in it. */
  reset(): void {
    this.asked = false;
    this.broughtUp = false;
  }
}
