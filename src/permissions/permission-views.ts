import type { PermissionMode } from "../config/app-config.js";
import type { Sessions } from "../registry/sessions.js";
import type { PermissionPolicy } from "./permission-policy.js";
import type { PendingForModel, PendingRequest } from "./permission-types.js";
import type { WaitingRequests } from "./waiting-requests.js";

const SECOND_MS = 1000;

/** The waiting requests and the current mode, as the model reads them and as the UI shows them. */
export class PermissionViews {
  constructor(
    private waiting: WaitingRequests,
    private sessions: Sessions,
    private policy: PermissionPolicy,
  ) {}

  get permissionMode(): PermissionMode {
    return this.policy.permissionMode;
  }

  list(): PendingForModel[] {
    return this.waiting.all().map((p) => ({
      id: p.id,
      project: p.project,
      request: p.description,
      destructive: p.destructive ? `yes - user must say "confirm ${p.destructive.verb}"` : "no",
      waitingSeconds: Math.round((Date.now() - p.createdAt) / SECOND_MS),
    }));
  }

  requests(): PendingRequest[] {
    return this.waiting.all().map((p) => ({
      id: p.id,
      project: p.project,
      session: p.session,
      label: this.sessions.labelOf(p.session),
      description: p.description,
      destructiveVerb: p.destructive?.verb,
      explanation: p.explanation,
      explaining: p.explaining,
      createdAt: p.createdAt,
    }));
  }
}
