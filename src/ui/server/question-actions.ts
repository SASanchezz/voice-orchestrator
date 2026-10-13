import type { QuestionReplies } from "../../questions/question-replies.js";
import type { AnswersByQuestion } from "../../questions/question-types.js";
import type { QuestionClicks } from "../question-popups.js";
import type { ActionReporter } from "./action-reporter.js";
import { answersBody } from "./request-body.js";
import type { WaitingViews } from "./waiting-views.js";

/** Answering a worker's questions by click, in the web UI or a pop-up. */
export class QuestionActions implements QuestionClicks {
  constructor(
    private replies: QuestionReplies,
    private views: WaitingViews,
    private reporter: ActionReporter,
  ) {}

  answer(id: string, body: unknown): string {
    return this.answerByClick(id, answersBody.parse(body).answers);
  }

  /** Shown in the timeline and told to the model, like every click. */
  answerByClick(id: string, answers: AnswersByQuestion): string {
    const about = this.labelOf(id);
    return this.reporter.reportAnswer({ about }, this.replies.answer(id, answers), id);
  }

  skip(id: string): string {
    const about = this.labelOf(id);
    return this.reporter.reportAnswer({ about }, this.replies.skip(id), id);
  }

  private labelOf(id: string): string | undefined {
    return this.views.questionsAsked().find((asked) => asked.id === id)?.label;
  }
}
