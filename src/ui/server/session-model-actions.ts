import type { SessionModels } from "../../workers/session-models.js";
import type { ActionReporter } from "./action-reporter.js";
import { sessionModelBody } from "./request-body.js";
import type { UiLookup } from "./ui-lookup.js";

/** Picking the model a session's worker runs on, from its tab's menu. */
export class SessionModelActions {
  constructor(
    private models: SessionModels,
    private lookup: UiLookup,
    private reporter: ActionReporter,
  ) {}

  setModel(sessionId: string, body: unknown): string {
    this.lookup.requireSession(sessionId);
    const { model } = sessionModelBody.parse(body);
    const message = model ? this.models.choose(sessionId, model) : this.models.useProjectModel(sessionId);
    return this.reporter.report(this.lookup.labelOf(sessionId), message);
  }
}
