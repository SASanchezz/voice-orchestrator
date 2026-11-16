import { PermissionAnnouncer } from "../permissions/permission-announcer.js";
import { EditScope } from "../permissions/edit-scope.js";
import { PermissionAnswers } from "../permissions/permission-answers.js";
import { PermissionBroker } from "../permissions/permission-broker.js";
import { PermissionExplanations } from "../permissions/permission-explanations.js";
import { PermissionPolicy } from "../permissions/permission-policy.js";
import type { ExplainCommand } from "../permissions/permission-types.js";
import { PermissionViews } from "../permissions/permission-views.js";
import { SpokenApprovals } from "../permissions/spoken-approvals.js";
import { WaitingRequests } from "../permissions/waiting-requests.js";
import type { Core } from "./core.js";

export interface PermissionParts {
  policy: PermissionPolicy;
  waiting: WaitingRequests;
  broker: PermissionBroker;
  answers: PermissionAnswers;
  views: PermissionViews;
  spoken: SpokenApprovals;
}

/** Without `explain`, requests are shown without a plain-language explanation. */
export function buildPermissions(
  { cfg, sessions, events, workerRules }: Core,
  explain?: ExplainCommand,
): PermissionParts {
  const edits = new EditScope((sessionId) => cfg.projects[sessions.session(sessionId).project].path);
  const policy = new PermissionPolicy(cfg.permissions.mode, workerRules, edits);
  const announcer = new PermissionAnnouncer(sessions, events, cfg.permissions);
  const waiting = new WaitingRequests(sessions, announcer);
  const explanations = explain && new PermissionExplanations(waiting, explain, announcer);
  const answers = new PermissionAnswers(waiting, sessions, cfg.permissions);
  return {
    policy,
    waiting,
    broker: new PermissionBroker(policy, waiting, explanations),
    answers,
    views: new PermissionViews(waiting, sessions, policy),
    spoken: new SpokenApprovals(waiting, answers, sessions),
  };
}
