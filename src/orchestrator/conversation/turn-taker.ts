import type { ConversationMemory } from "../memory/conversation-memory.js";
import type { ConversationLine } from "./conversation-lines.js";
import type { ReplyPresenter, ReplySubject } from "./reply-presenter.js";
import { onScreen } from "./reply-text.js";
import type { TurnContext } from "./turn-context.js";

/** One exchange with the model: what it is sent, what is remembered of it, and whether the reply is spoken. */
export interface Turn extends ReplySubject {
  message: string;
  /** How the exchange is remembered across resets, e.g. "user: run the tests". */
  heard: string;
  /** Your words, for confirm-phrase checks; undefined for notifications. */
  utterance?: string;
  aloud: boolean;
  /** Add "(N more waiting)" when more notifications are queued. */
  mentionWaiting: boolean;
}

/** Gives the model a turn with your clicks since the last one, and remembers the exchange. */
export class TurnTaker {
  constructor(
    private presenter: ReplyPresenter,
    private memory: ConversationMemory,
    private context: TurnContext,
  ) {}

  async take(turn: Turn): Promise<string> {
    this.context.beginTurn(turn.utterance);
    const message = turn.mentionWaiting ? turn.message + this.context.waitingNote() : turn.message;
    const content = [...this.context.takeUiNotes(), message].join("\n");
    const reply = turn.aloud
      ? await this.presenter.askAloud(content, turn)
      : await this.presenter.askShown(content, turn);
    this.context.endTurn();
    if (reply) this.memory.record(turn.heard, onScreen(reply));
    return reply;
  }

  showLine(line: ConversationLine): void {
    this.presenter.showLine(line);
  }
}
