import type { PermissionAnswers } from "../../permissions/permission-answers.js";
import type { Decision, PendingRequest } from "../../permissions/permission-types.js";
import type { PermissionViews } from "../../permissions/permission-views.js";
import type { ActionReporter, AnswerSubject } from "./action-reporter.js";
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
    const request = this.views.requests().find((r) => r.id === id);
    const message = this.answers.answerByClick(id, decision);
    return this.reporter.reportAnswer(answerSubject(request), message, id);
  }
}

/** Shown under the asker's label, linking to its session; a request gone meanwhile has neither. */
function answerSubject(request: PendingRequest | undefined): AnswerSubject {
  if (!request) return {};
  const { label, project, session, sessionNumber } = request;
  return { about: label, session: { project, id: session, number: sessionNumber } };
}
