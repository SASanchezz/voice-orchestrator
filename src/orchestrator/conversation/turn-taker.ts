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

/** How the model learns of an exchange it sat out, e.g. a camera question the local vision model answered. */
const ANSWERED_WITHOUT_MODEL = "[ANSWERED WITHOUT YOU, by the local vision model]";

/** What your own words' turns need: your words go to the model, or are answered without it. */
export type UserTurnTaker = Pick<TurnTaker, "take" | "showLine">;

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

  /** A turn the model sits out because its reply is already known; the model reads both with your next message. */
  async takeAnswered(turn: Turn, reply: string): Promise<string> {
    this.context.beginTurn(turn.utterance);
    this.presenter.showReply(reply);
    if (turn.aloud) await this.presenter.speakReply(reply, turn);
    this.context.endTurn();
    this.context.addUiNote(`${ANSWERED_WITHOUT_MODEL} ${turn.heard} / replied: ${reply}`);
    this.memory.record(turn.heard, reply);
    return reply;
  }

  showLine(line: ConversationLine): void {
    this.presenter.showLine(line);
  }
}
