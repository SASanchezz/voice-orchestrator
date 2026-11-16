import type { PermissionResult, PermissionUpdate } from "@anthropic-ai/claude-agent-sdk";
import type { AppConfig } from "../config/app-config.js";
import type { Sessions } from "../registry/sessions.js";
import { utteranceConfirms } from "../safety/confirm-phrase.js";
import type { Decision, Pending } from "./permission-types.js";
import type { WaitingRequests } from "./waiting-requests.js";

type Allowance = Exclude<Decision, "deny">;
type AlwaysDestination = AppConfig["permissions"]["alwaysDestination"];

/** Your answers to waiting requests, by voice or by click. Destructive ones are never allowed "always". */
export class PermissionAnswers {
  constructor(
    private waiting: WaitingRequests,
    private sessions: Sessions,
    private settings: AppConfig["permissions"],
  ) {}

  denyBySpeech(id: string, reason?: string): string {
    const pending = this.waiting.find(id);
    if (!pending) return `No pending request ${id}.`;
    return this.deny(pending, reason || "The user denied this by voice.");
  }

  /**
   * `utterance` is the user's actual last transcript, supplied by the orchestrator runtime (not by the model),
   * so the model cannot approve a destructive action on its own.
   */
  allowBySpeech(id: string, decision: Allowance, utterance: string | undefined): string {
    const pending = this.waiting.find(id);
    if (!pending) return `No pending request ${id}.`;
    return spokenRefusal(pending, decision, utterance) ?? this.allow(pending, decision);
  }

  /** The UI puts destructive requests behind a dialog naming the exact command, so that click is the confirmation. */
  answerByClick(id: string, decision: Decision): string {
    return this.answerDirectly(id, decision, "The user denied this in the UI.");
  }

  /**
   * A message that was nothing but "allow" or "deny", matched in code to this one request: like a click, it is the
   * confirmation, so a destructive request needs no verb said.
   */
  answerBySpokenApproval(id: string, decision: Decision): string {
    return this.answerDirectly(id, decision, "The user denied this by voice.");
  }

  private answerDirectly(id: string, decision: Decision, deniedMessage: string): string {
    const pending = this.waiting.find(id);
    if (!pending) return `No pending request ${id}.`;
    if (decision === "deny") return this.deny(pending, deniedMessage);
    if (pending.destructive && decision === "always") return `Refused: destructive actions can't be always-allowed.`;
    return this.allow(pending, decision);
  }

  private deny(pending: Pending, message: string): string {
    this.waiting.finish(pending.id, { behavior: "deny", message });
    return `Denied ${this.sessions.labelOf(pending.session)}: ${pending.description}`;
  }

  private allow(pending: Pending, decision: Allowance): string {
    const label = this.sessions.labelOf(pending.session);
    this.waiting.finish(pending.id, allowResult(pending, decision, this.settings.alwaysDestination));
    return `Allowed${decision === "always" ? " permanently" : " once"}: ${label}: ${pending.description}`;
  }
}

/** Why a spoken answer can't allow a destructive request; undefined when it can. */
function spokenRefusal(pending: Pending, decision: Allowance, utterance: string | undefined): string | undefined {
  if (!pending.destructive) return undefined;
  const { verb } = pending.destructive;
  if (decision === "always")
    return `Refused: destructive actions can't be always-allowed. Ask the user to say "confirm ${verb}" to allow it once.`;
  if (!utteranceConfirms(utterance, verb))
    return `Not approved: destructive. The user's last words did not contain "confirm ${verb}" or "allow ${verb}". Ask them to say one.`;
  return undefined;
}

/** "Always" is saved so the same request is not asked again (also in your VS Code sessions for that project). */
function allowResult(pending: Pending, decision: Allowance, destination: AlwaysDestination): PermissionResult {
  const result: PermissionResult = { behavior: "allow" };
  if (decision === "always" && pending.suggestions?.length)
    result.updatedPermissions = pending.suggestions.map((s): PermissionUpdate =>
      "destination" in s ? { ...s, destination } : s,
    );
  return result;
}
