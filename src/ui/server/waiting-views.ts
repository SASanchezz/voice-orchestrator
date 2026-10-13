import type { PermissionMode } from "../../config/app-config.js";
import type { PermissionViews } from "../../permissions/permission-views.js";
import type { WaitingQuestions } from "../../questions/waiting-questions.js";
import type { Sessions } from "../../registry/sessions.js";
import type { PendingQuestionView, PendingRequestView } from "../protocol.js";

/** What waits for your answer, as the page shows it: workers' permission requests and their questions. */
export class WaitingViews {
  constructor(
    private permissions: PermissionViews,
    private questions: WaitingQuestions,
    private sessions: Sessions,
  ) {}

  get permissionMode(): PermissionMode {
    return this.permissions.permissionMode;
  }

  requests(): PendingRequestView[] {
    return this.permissions.requests();
  }

  questionsAsked(): PendingQuestionView[] {
    return this.questions.all().map(({ id, session, questions, createdAt }) => ({
      id,
      session,
      label: this.sessions.labelOf(session),
      questions,
      createdAt,
    }));
  }
}
