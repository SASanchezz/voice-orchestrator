import type { ConfirmAsk } from "../orchestrator/conversation/confirm-ask.js";
import { cancelWords, confirmWords } from "./confirm-request.js";
import { confirmSummary } from "./confirm-summary.js";
import type { LatestReply } from "./latest-reply.js";
import type { OpenPanel, PanelButton } from "./question-popups.js";

/** Takes words as if you had typed them in the assistant's chat. */
export interface TypedWords {
  receiveTyped(text: string): void;
}

/** Typed words that can also cut off the assistant's reply being said, without typing anything. */
export interface ReplyWords extends TypedWords {
  silenceReply(): void;
}

/** What a confirm pop-up shows, laid out like a permission pop-up: buttons side by side, Cancel first. */
export interface ConfirmPanel {
  title: string;
  warning: string;
  summary: string;
  buttons: PanelButton[];
}

/** Shows native confirm pop-ups; `chosen` gets the clicked button's answer, and `seen` your first click anywhere in one. */
export interface ConfirmPanelDevice {
  ask(panel: ConfirmPanel, chosen: (answer: string) => void, seen: () => void): OpenPanel;
}

/** The open permission pop-ups, whose Allow may already stand for the phrase asked. */
export interface OpenPermissionPopups {
  isAsking(verb: string): boolean;
}

const TITLE = "Assistant waits for your confirmation";
const CANCEL_ANSWER = "cancel";
const CONFIRM_ANSWER_PREFIX = "confirm:";

/**
 * A native pop-up for the assistant's request to say a confirm phrase, so a skipped spoken reply still shows it
 * from any app. Its buttons say the same words the web UI's Confirm and Cancel do; it closes on your next words.
 * None opens when a permission pop-up's Allow already stands for every phrase asked: one decision, one pop-up.
 * Your first click on it, even off its buttons, cuts off the reply being said: you are already reading it.
 */
export class ConfirmPopups {
  private open: OpenPanel | undefined;

  constructor(
    private device: ConfirmPanelDevice,
    private typed: ReplyWords,
    private permissionPopups: OpenPermissionPopups,
  ) {}

  follow(confirmAsk: ConfirmAsk, latestReply: LatestReply): void {
    confirmAsk.on("asked", (verbs: string[]) => this.show(verbs, latestReply.text));
    confirmAsk.on("closed", () => this.close());
  }

  private show(verbs: string[], reply: string): void {
    this.close();
    const isCovered = verbs.every((verb) => this.permissionPopups.isAsking(verb));
    if (isCovered) return;
    const panel = panelFor(verbs, confirmSummary(reply, verbs));
    const chosen = (answer: string) => this.chosen(verbs, answer);
    this.open = this.device.ask(panel, chosen, () => this.typed.silenceReply());
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

function panelFor(verbs: string[], summary: string): ConfirmPanel {
  const cancel: PanelButton = { answer: CANCEL_ANSWER, label: "Cancel" };
  return { title: TITLE, warning: warningFor(verbs), summary, buttons: [cancel, ...verbs.map(confirmButton)] };
}

/** Worded like a destructive permission pop-up's warning. */
function warningFor(verbs: string[]): string {
  const phrases = verbs.map((verb) => `"${confirmWords(verb)}"`).join(" or ");
  return `Destructive (${verbs.join(", ")}). Confirm counts as saying ${phrases}.`;
}

function confirmButton(verb: string): PanelButton {
  return { answer: `${CONFIRM_ANSWER_PREFIX}${verb}`, label: `Confirm ${verb}` };
}
