import type { PermissionResult, PermissionUpdate } from "@anthropic-ai/claude-agent-sdk";
import { DestructiveList, DestructiveRule, describeToolCall, utteranceConfirms } from "./destructive.js";
import { Registry } from "./registry.js";
import type { AppConfig, PermissionMode } from "./config.js";

export type Decision = "once" | "always" | "deny";

/** Plain-language explanation of a worker's command, for the approval card. */
export type ExplainCommand = (project: string, command: string) => Promise<string>;

/** A waiting request as the UI shows it. */
export interface PendingRequest {
  id: string;
  project: string;
  session: string;
  /** How the UI names the asker: the project, plus the session number when it has several. */
  label: string;
  description: string;
  destructiveVerb?: string;
  /** What a destructive command will do and how risky it is, in plain words; once it has been written. */
  explanation?: string;
  /** True while the explanation is being written. */
  explaining: boolean;
  createdAt: number;
}

interface Pending {
  id: string;
  project: string;
  session: string;
  toolName: string;
  description: string;
  destructive?: DestructiveRule;
  suggestions?: PermissionUpdate[];
  explanation?: string;
  explaining: boolean;
  createdAt: number;
  resolve: (r: PermissionResult) => void;
  reminder: NodeJS.Timeout;
}

/**
 * Bridges worker permission prompts to voice.
 * Workers block in canUseTool until you answer; nothing is ever auto-approved on timeout.
 */
export class PermissionBroker {
  private pending = new Map<string, Pending>();
  private seq = 0;
  private mode: PermissionMode;

  constructor(
    private cfg: AppConfig,
    private registry: Registry,
    private destructive: DestructiveList,
    private explainCommand?: ExplainCommand,
  ) {
    this.mode = cfg.permissions.mode;
  }

  /** Switch for the rest of this run; the mode at start comes from config. */
  setMode(mode: PermissionMode): string {
    this.mode = mode;
    return mode === "auto"
      ? "Auto mode: workers run everything without asking, except destructive commands."
      : "Ask mode: every permission request goes to the user.";
  }

  /** Called from a worker's canUseTool. Resolves at once in auto mode, otherwise when you answer by voice. */
  request(
    sessionId: string,
    toolName: string,
    input: Record<string, unknown>,
    suggestions: PermissionUpdate[] | undefined,
    signal: AbortSignal,
  ): Promise<PermissionResult> {
    const destructive = this.destructive.match(toolName, input);
    if (this.mode === "auto" && !destructive) return Promise.resolve({ behavior: "allow" });
    const id = `p${++this.seq}`;
    const description = `${toolName}: ${describeToolCall(toolName, input).slice(0, 300)}`;
    const { project } = this.registry.session(sessionId);

    return new Promise<PermissionResult>((resolve) => {
      const minutes = this.cfg.permissions.reminderMinutes;
      const reminder = setInterval(() => this.announce(id, true), minutes * 60_000);
      const explaining = Boolean(destructive && this.explainCommand);
      this.pending.set(id, { id, project, session: sessionId, toolName, description, destructive, suggestions, explaining, createdAt: Date.now(), resolve, reminder });
      this.registry.updateSession(sessionId, { status: "waiting_permission" });
      if (explaining) void this.attachExplanation(id, project, describeToolCall(toolName, input));

      signal.addEventListener("abort", () => {
        this.finish(id, { behavior: "deny", message: "Run was stopped." });
      });
      this.announce(id, false);
    });
  }

  get permissionMode(): PermissionMode {
    return this.mode;
  }

  /** Waiting requests in the form the model reads. */
  list() {
    return this.requests().map((p) => ({
      id: p.id,
      project: p.project,
      request: p.description,
      destructive: p.destructiveVerb ? `yes - user must say "confirm ${p.destructiveVerb}"` : "no",
      waitingSeconds: Math.round((Date.now() - p.createdAt) / 1000),
    }));
  }

  requests(): PendingRequest[] {
    return [...this.pending.values()].map((p) => ({
      id: p.id,
      project: p.project,
      session: p.session,
      label: this.registry.labelOf(p.session),
      description: p.description,
      destructiveVerb: p.destructive?.verb,
      explanation: p.explanation,
      explaining: p.explaining,
      createdAt: p.createdAt,
    }));
  }

  isPending(id: string): boolean {
    return this.pending.has(id);
  }

  /**
   * Answer a pending request. `utterance` is the user's actual last transcript,
   * supplied by the orchestrator runtime (not by the model), so the model
   * cannot approve a destructive action on its own.
   */
  answer(id: string, decision: Decision, utterance: string | undefined, denyReason?: string): string {
    const p = this.pending.get(id);
    if (!p) return `No pending request ${id}.`;
    if (decision === "deny") return this.deny(p, denyReason || "The user denied this by voice.");
    if (p.destructive) {
      if (decision === "always")
        return `Refused: destructive actions can't be always-allowed. Ask the user to say "confirm ${p.destructive.verb}" to allow it once.`;
      if (!utteranceConfirms(utterance, p.destructive.verb))
        return `Not approved: destructive. The user's last words did not contain "confirm ${p.destructive.verb}". Ask them to say exactly that.`;
    }
    return this.allow(p, decision);
  }

  /**
   * Answer from a click in the UI. The UI puts destructive requests behind a dialog
   * naming the exact command, so that click is the confirmation; "always" stays refused.
   */
  answerByClick(id: string, decision: Decision): string {
    const p = this.pending.get(id);
    if (!p) return `No pending request ${id}.`;
    if (decision === "deny") return this.deny(p, "The user denied this in the UI.");
    if (p.destructive && decision === "always") return `Refused: destructive actions can't be always-allowed.`;
    return this.allow(p, decision);
  }

  /** Writes the plain-language explanation onto the request; the card shows it once it arrives. */
  private async attachExplanation(id: string, project: string, command: string) {
    const explanation = await this.explainOrNothing(project, command);
    const p = this.pending.get(id);
    if (!p) return; // answered meanwhile
    p.explanation = explanation;
    p.explaining = false;
  }

  private async explainOrNothing(project: string, command: string): Promise<string | undefined> {
    try {
      return (await this.explainCommand!(project, command)) || undefined;
    } catch (e) {
      console.error(`[permissions] couldn't explain the command: ${(e as Error).message}`);
      return undefined;
    }
  }

  private deny(p: Pending, message: string): string {
    this.finish(p.id, { behavior: "deny", message });
    return `Denied ${this.registry.labelOf(p.session)}: ${p.description}`;
  }

  private allow(p: Pending, decision: Exclude<Decision, "deny">): string {
    const label = this.registry.labelOf(p.session);
    const result: PermissionResult = { behavior: "allow" };
    if (decision === "always" && p.suggestions?.length) {
      // Persist so the same request is not asked again (also applies to your VS Code sessions for that project).
      result.updatedPermissions = p.suggestions.map((s) =>
        "destination" in s ? { ...s, destination: this.cfg.permissions.alwaysDestination } : s,
      ) as PermissionUpdate[];
    }
    this.finish(p.id, result);
    return `Allowed${decision === "always" ? " permanently" : " once"}: ${label}: ${p.description}`;
  }

  private finish(id: string, result: PermissionResult) {
    const p = this.pending.get(id);
    if (!p) return;
    clearInterval(p.reminder);
    this.pending.delete(id);
    const stillWaiting = [...this.pending.values()].some((x) => x.session === p.session);
    if (!stillWaiting && this.registry.session(p.session).status === "waiting_permission")
      this.registry.updateSession(p.session, { status: "running" });
    p.resolve(result);
  }

  private announce(id: string, reminder: boolean) {
    const p = this.pending.get(id);
    if (!p) return;
    this.registry.emitEvent({
      kind: "permission",
      id,
      project: p.project,
      session: p.session,
      label: this.registry.labelOf(p.session),
      description: p.description,
      destructiveVerb: p.destructive?.verb,
      reminder,
    });
  }
}
