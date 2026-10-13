import type { Sessions } from "../registry/sessions.js";
import type { AnswersByQuestion, PendingQuestions } from "./question-types.js";
import type { WaitingQuestions } from "./waiting-questions.js";

const SKIPPED_MESSAGE = "The user skipped these questions without answering. Carry on with your best judgement.";

/** Your answers to a worker's questions, from the web UI or a pop-up; the worker continues with them. */
export class QuestionReplies {
  constructor(
    private waiting: WaitingQuestions,
    private sessions: Sessions,
  ) {}

  /** Every question needs an answer: one of its options, several joined with ", ", or your own words. */
  answer(id: string, answers: AnswersByQuestion): string {
    const pending = this.waiting.find(id);
    if (!pending) return `No pending question ${id}.`;
    const missing = pending.questions.find(({ question }) => !answerTo(answers, question));
    if (missing) return `Not sent: "${missing.question}" has no answer yet.`;
    const given = Object.fromEntries(pending.questions.map(({ question }) => [question, answerTo(answers, question)]));
    this.waiting.finish(id, { behavior: "allow", updatedInput: { ...pending.input, answers: given } });
    return `Answered ${this.labelOf(pending)}: ${summaryOf(given)}`;
  }

  /** The worker hears you skipped them and carries on without your answers. */
  skip(id: string): string {
    const pending = this.waiting.find(id);
    if (!pending) return `No pending question ${id}.`;
    this.waiting.finish(id, { behavior: "deny", message: SKIPPED_MESSAGE });
    return `Skipped ${this.labelOf(pending)}'s questions.`;
  }

  private labelOf(pending: PendingQuestions): string {
    return this.sessions.labelOf(pending.session);
  }
}

function answerTo(answers: AnswersByQuestion, question: string): string {
  return Object.hasOwn(answers, question) ? answers[question].trim() : "";
}

/** "Which database?" → Postgres; "Which port?" → 5432 */
function summaryOf(given: AnswersByQuestion): string {
  return Object.entries(given)
    .map(([question, answer]) => `"${question}" → ${answer}`)
    .join("; ");
}
