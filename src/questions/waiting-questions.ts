import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { AppEvents } from "../events/app-events.js";
import type { Sessions } from "../registry/sessions.js";
import type { NewQuestions, PendingQuestions } from "./question-types.js";

const STOPPED: PermissionResult = { behavior: "deny", message: "Run was stopped." };

/**
 * Worker questions waiting for your answers. The worker blocks until it gets them; nothing is ever answered for you.
 * Each one is announced once, and withdrawn when answered or when its worker stops.
 */
export class WaitingQuestions {
  private byId = new Map<string, PendingQuestions>();

  constructor(
    private sessions: Sessions,
    private events: AppEvents,
  ) {}

  /** Starts waiting: the session shows it, and stopping the worker ends it. */
  open(asked: NewQuestions, signal: AbortSignal): void {
    const { id, session, questions } = asked;
    const project = this.sessions.session(session).project;
    this.byId.set(id, { ...asked, project, createdAt: Date.now() });
    this.sessions.updateSession(session, { status: "waiting_permission" });
    signal.addEventListener("abort", () => this.finish(id, STOPPED));
    const label = this.sessions.labelOf(session);
    this.events.emitEvent({ kind: "question", id, project, session, label, questions });
  }

  find(id: string): PendingQuestions | undefined {
    return this.byId.get(id);
  }

  all(): PendingQuestions[] {
    return [...this.byId.values()];
  }

  /** Unblocks the worker with this result; its session runs again once it has no other questions waiting. */
  finish(id: string, result: PermissionResult): void {
    const pending = this.byId.get(id);
    if (!pending) return;
    this.byId.delete(id);
    this.events.emitQuestionClosed(id);
    const stillWaiting = this.all().some((other) => other.session === pending.session);
    if (!stillWaiting && this.sessions.session(pending.session).status === "waiting_permission")
      this.sessions.updateSession(pending.session, { status: "running" });
    pending.resolve(result);
  }
}
