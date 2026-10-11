import type { PermissionAnswers } from "../../permissions/permission-answers.js";
import type { Decision } from "../../permissions/permission-types.js";
import type { PermissionViews } from "../../permissions/permission-views.js";
import type { ActionReporter } from "./action-reporter.js";
import type { ClickAnswers } from "../permission-popups.js";
import { decisionBody } from "./request-body.js";

/** Answering a worker's permission request by click, in the web UI or a pop-up. */
export class PermissionActions implements ClickAnswers {
  constructor(
    private answers: PermissionAnswers,
    private views: PermissionViews,
    private reporter: ActionReporter,
  ) {}

  answer(id: string, body: unknown): string {
    return this.answerByClick(id, decisionBody.parse(body).decision);
  }

  /** Shown in the timeline and told to the model, like every click. */
  answerByClick(id: string, decision: Decision): string {
    const about = this.views.requests().find((r) => r.id === id)?.label;
    const message = this.answers.answerByClick(id, decision);
    return this.reporter.reportAnswer(about, message, id);
  }
}
