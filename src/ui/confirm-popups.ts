import type { ConfirmAsk } from "../orchestrator/conversation/confirm-ask.js";
import type { ConversationLine, ConversationLines } from "../orchestrator/conversation/conversation-lines.js";
import { cancelWords, confirmWords } from "./confirm-request.js";
import type { OpenPanel, PanelButton, QuestionPanel, QuestionPanelDevice } from "./question-popups.js";

/** Takes words as if you had typed them in the assistant's chat. */
export interface TypedWords {
  receiveTyped(text: string): void;
}

const TITLE = "Assistant waits for your confirmation";
const CANCEL_ANSWER = "cancel";
const CONFIRM_ANSWER_PREFIX = "confirm:";

/**
 * A native pop-up for the assistant's request to say a confirm phrase, so a skipped spoken reply still shows it
 * from any app. Its buttons say the same words the web UI's Confirm and Cancel do; it closes on your next words.
 */
export class ConfirmPopups {
  private open: OpenPanel | undefined;
  private latestReply = "";

  constructor(
    private device: QuestionPanelDevice,
    private typed: TypedWords,
  ) {}

  follow(confirmAsk: ConfirmAsk, lines: ConversationLines): void {
    lines.on("line", (line: ConversationLine) => this.remember(line));
    confirmAsk.on("asked", (verbs: string[]) => this.show(verbs));
    confirmAsk.on("closed", () => this.close());
  }

  /** The assistant's reply since your last words, which a reply streamed in pieces adds to. */
  private remember({ role, text }: ConversationLine): void {
    if (role === "user") this.latestReply = "";
    else this.latestReply = [this.latestReply, text].filter(Boolean).join("\n\n");
  }

  private show(verbs: string[]): void {
    this.close();
    const panel = panelFor(verbs, this.latestReply);
    this.open = this.device.ask(panel, (answer) => this.chosen(verbs, answer));
  }

  private chosen(verbs: string[], answer: string): void {
    this.open = undefined;
    if (answer === CANCEL_ANSWER) return this.typed.receiveTyped(cancelWords(verbs));
    const verb = answer.startsWith(CONFIRM_ANSWER_PREFIX) ? answer.slice(CONFIRM_ANSWER_PREFIX.length) : "";
    if (verbs.includes(verb)) this.typed.receiveTyped(confirmWords(verb));
  }

  private close(): void {
    this.open?.close();
    this.open = undefined;
  }
}

function panelFor(verbs: string[], reply: string): QuestionPanel {
  const confirms = verbs.map(confirmButton);
  const cancel: PanelButton = { answer: CANCEL_ANSWER, label: "Cancel" };
  return { title: TITLE, detail: reply, buttons: [...confirms, cancel], acceptsText: false };
}

function confirmButton(verb: string): PanelButton {
  return { answer: `${CONFIRM_ANSWER_PREFIX}${verb}`, label: `Confirm ${verb}` };
}
