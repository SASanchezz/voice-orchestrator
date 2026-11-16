import type { ConversationLine } from "../../orchestrator/conversation/conversation-lines.js";
import type { ChatLine } from "./chat-panel.js";

/** Enough to scroll back over the last few exchanges without the pop-up growing without end. */
const MAX_LINES = 40;
const PARAGRAPH_BREAK = "\n\n";
const QUESTION_MARK = "?";

/** The last lines of your dialogue with the assistant; the pieces of one streamed reply join into one message. */
export class RecentDialogue {
  private lines: ChatLine[] = [];
  private replyGoesOn = false;

  add({ role, text }: ConversationLine): void {
    const last = this.lines.at(-1);
    const continuesReply = role === "orchestrator" && this.replyGoesOn && last;
    this.replyGoesOn = role === "orchestrator";
    if (continuesReply) return this.replaceLast({ role, text: last.text + PARAGRAPH_BREAK + text });
    this.lines = [...this.lines, { role, text }].slice(-MAX_LINES);
  }

  /** The reply is finished: the assistant's next words start a message of their own. */
  endReply(): void {
    this.replyGoesOn = false;
  }

  get recent(): ChatLine[] {
    return this.lines;
  }

  /** The assistant's last words ask you something. */
  endsWithQuestion(): boolean {
    const last = this.lines.at(-1);
    return last?.role === "orchestrator" && last.text.trimEnd().endsWith(QUESTION_MARK);
  }

  private replaceLast(line: ChatLine): void {
    this.lines = [...this.lines.slice(0, -1), line];
  }
}
