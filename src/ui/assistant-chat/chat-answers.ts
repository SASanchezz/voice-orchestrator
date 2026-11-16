import type { TypedWords } from "../confirm-popups.js";
import { GO_AHEAD_CANCEL_WORDS, GO_AHEAD_YES_WORDS } from "../confirm-request.js";

const APPROVE_ANSWER = "yes";
const DENY_ANSWER = "cancel";
const TEXT_ANSWER_PREFIX = "text:";

/** A click or message in the chat pop-up, typed as your words: Approve says "yes", Deny "cancel", the field its text. */
export function typeChatAnswer(answer: string, typed: TypedWords): void {
  if (answer === APPROVE_ANSWER) return typed.receiveTyped(GO_AHEAD_YES_WORDS);
  if (answer === DENY_ANSWER) return typed.receiveTyped(GO_AHEAD_CANCEL_WORDS);
  if (answer.startsWith(TEXT_ANSWER_PREFIX)) typed.receiveTyped(answer.slice(TEXT_ANSWER_PREFIX.length));
}
