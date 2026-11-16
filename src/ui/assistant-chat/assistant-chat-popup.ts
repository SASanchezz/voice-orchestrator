import type { ConfirmAsk } from "../../orchestrator/conversation/confirm-ask.js";
import type { ConversationLine, ConversationLines } from "../../orchestrator/conversation/conversation-lines.js";
import type { TurnContext } from "../../orchestrator/conversation/turn-context.js";
import type { ReplyWords } from "../confirm-popups.js";
import { typeChatAnswer } from "./chat-answers.js";
import type { ChatPanel, ChatPanelDevice, ChatView } from "./chat-panel.js";
import { RecentDialogue } from "./recent-dialogue.js";
import { TurnAnswer } from "./turn-answer.js";

const CHAT_TITLE = "Assistant";
const GO_AHEAD_TITLE = "Assistant waits for your go-ahead";

/**
 * A native chat pop-up with your recent dialogue with the assistant, so you see from any app that it answered and can
 * answer back. Only what you asked and its answers show: what it says on its own about a notification (a permission
 * request, a task that ended) is left out, as you hear it and see it elsewhere. Deny and Approve show while it asks you
 * something. Each answer to you brings it up with its first words, which are shown before they are spoken, so you can
 * read along as you hear it: the open one comes to the front, or a new one opens once you closed it. Approve says
 * "yes", Deny says "cancel", and the field sends your words, all as if you had typed them; it stays open. While a
 * confirm phrase is asked it isn't brought up, since the confirm pop-up comes up for that. Your first click into it
 * after it comes up, even off its buttons, cuts off the reply being said: you are already reading it.
 */
export class AssistantChatPopup {
  private panel: ChatPanel | undefined;
  private dialogue = new RecentDialogue();
  private turn = new TurnAnswer();

  constructor(
    private device: ChatPanelDevice,
    private typed: ReplyWords,
    private confirmAsk: ConfirmAsk,
  ) {}

  follow(lines: ConversationLines, turns: Pick<TurnContext, "onTurnEnd">): void {
    lines.on("line", (line: ConversationLine) => this.heard(line));
    turns.onTurnEnd(() => this.replyFinished());
  }

  private heard(line: ConversationLine): void {
    this.turn.heard(line);
    if (!this.turn.isForYou(line)) return;
    this.dialogue.add(line);
    if (this.turn.startsAnswer(line)) return this.bringUp();
    this.panel?.update(this.view());
  }

  /** The finished reply may have asked for a go-ahead since its first words, which changes the title and buttons. */
  private replyFinished(): void {
    this.turn.reset();
    this.dialogue.endReply();
    this.panel?.update(this.view());
  }

  private bringUp(): void {
    this.turn.markBroughtUp();
    const isConfirmAsked = this.confirmAsk.verbs.length > 0;
    if (isConfirmAsked) return this.panel?.update(this.view());
    const panel = this.panel ?? this.opened();
    panel.update(this.view());
    panel.raise();
  }

  private opened(): ChatPanel {
    const panel = this.device.open({
      chosen: (answer) => typeChatAnswer(answer, this.typed),
      seen: () => this.typed.silenceReply(),
      closed: () => (this.panel = undefined),
    });
    this.panel = panel;
    return panel;
  }

  private view(): ChatView {
    const title = this.confirmAsk.goAheadAsked ? GO_AHEAD_TITLE : CHAT_TITLE;
    return { title, offersApproval: this.waitsForAnswer(), lines: this.dialogue.recent };
  }

  /** Deny and Approve only make sense while the assistant's last words ask you something. */
  private waitsForAnswer(): boolean {
    return this.confirmAsk.goAheadAsked || this.dialogue.endsWithQuestion();
  }
}
