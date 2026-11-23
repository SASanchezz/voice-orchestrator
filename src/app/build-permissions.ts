import { PermissionAnnouncer } from "../permissions/permission-announcer.js";
import { EditScope } from "../permissions/edit-scope.js";
import { PermissionAnswers } from "../permissions/permission-answers.js";
import { PermissionBroker } from "../permissions/permission-broker.js";
import { PermissionExplanations } from "../permissions/permission-explanations.js";
import { PermissionPolicy } from "../permissions/permission-policy.js";
import { PermissionReview } from "../permissions/permission-review.js";
import type { ExplainCommand, PermissionRequests, ReviewCommand } from "../permissions/permission-types.js";
import { PermissionViews } from "../permissions/permission-views.js";
import { ReviewedRequests } from "../permissions/reviewed-requests.js";
import { SpokenApprovals } from "../permissions/spoken-approvals.js";
import { WaitingRequests } from "../permissions/waiting-requests.js";
import type { Core } from "./core.js";

export interface PermissionParts {
  policy: PermissionPolicy;
  waiting: WaitingRequests;
  broker: PermissionRequests;
  answers: PermissionAnswers;
  views: PermissionViews;
  spoken: SpokenApprovals;
}

/** Without `explain`, requests are shown without a plain-language explanation; without `review`, all of them ask you. */
export function buildPermissions(core: Core, explain?: ExplainCommand, review?: ReviewCommand): PermissionParts {
  const { cfg, sessions, events } = core;
  const policy = buildPolicy(core);
  const announcer = new PermissionAnnouncer(sessions, events, cfg.permissions);
  const waiting = new WaitingRequests(sessions, announcer);
  const explanations = explain && new PermissionExplanations(waiting, explain, announcer);
  const broker = new PermissionBroker(policy, waiting, explanations);
  const answers = new PermissionAnswers(waiting, sessions, cfg.permissions);
  return {
    policy,
    waiting,
    broker: review ? new ReviewedRequests(policy, new PermissionReview(sessions, review), broker) : broker,
    answers,
    views: new PermissionViews(waiting, sessions, policy),
    spoken: new SpokenApprovals(waiting, answers, sessions),
  };
}

function buildPolicy({ cfg, sessions, workerRules }: Core): PermissionPolicy {
  const edits = new EditScope((sessionId) => cfg.projects[sessions.session(sessionId).project].path);
  return new PermissionPolicy(cfg.permissions.mode, workerRules, edits);
}
