import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { Sessions } from "../registry/sessions.js";
import { describeToolCall } from "../safety/tool-calls.js";
import type { PermissionAnnouncer } from "./permission-announcer.js";
import type { NewRequest, Pending } from "./permission-types.js";

const DESCRIPTION_CHARS = 300;
const STOPPED: PermissionResult = { behavior: "deny", message: "Run was stopped." };

/**
 * Worker permission requests waiting for your answer. Workers block until theirs is finished;
 * nothing is ever auto-approved on timeout. Unanswered requests are announced again every few minutes.
 */
export class WaitingRequests {
  private byId = new Map<string, Pending>();

  constructor(
    private sessions: Sessions,
    private announcer: PermissionAnnouncer,
  ) {}

  /** Starts waiting: the session shows it, and stopping the worker denies the request. */
  open(request: NewRequest, signal: AbortSignal): void {
    const { id, session } = request;
    const reminder = this.announcer.remindEvery(() => this.byId.get(id));
    this.byId.set(id, toPending(request, this.sessions.session(session).project, reminder));
    this.sessions.updateSession(session, { status: "waiting_permission" });
    signal.addEventListener("abort", () => this.finish(id, STOPPED));
  }

  announce(id: string): void {
    const pending = this.byId.get(id);
    if (pending) this.announcer.announce(pending);
  }

  find(id: string): Pending | undefined {
    return this.byId.get(id);
  }

  isPending(id: string): boolean {
    return this.byId.has(id);
  }

  all(): Pending[] {
    return [...this.byId.values()];
  }

  /** Unblocks the worker with this answer; its session runs again once it has nothing else waiting. */
  finish(id: string, result: PermissionResult): void {
    const pending = this.byId.get(id);
    if (!pending) return;
    clearInterval(pending.reminder);
    this.byId.delete(id);
    this.announcer.withdraw(id);
    const stillWaiting = this.all().some((other) => other.session === pending.session);
    if (!stillWaiting && this.sessions.session(pending.session).status === "waiting_permission")
      this.sessions.updateSession(pending.session, { status: "running" });
    pending.resolve(result);
  }
}

function toPending(request: NewRequest, project: string, reminder: NodeJS.Timeout): Pending {
  const { call, ...rest } = request;
  const description = `${call.toolName}: ${shortened(describeToolCall(call.toolName, call.input))}`;
  return { ...rest, project, description, createdAt: Date.now(), reminder };
}

/** Only for showing and saying it; every check reads the whole command. */
function shortened(text: string): string {
  return text.length > DESCRIPTION_CHARS ? `${text.slice(0, DESCRIPTION_CHARS)}…` : text;
}
