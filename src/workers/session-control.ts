import type { Registry } from "../registry/registry.js";
import type { SessionRuns } from "./session-runs.js";
import type { WorkerDirectory } from "./worker-directory.js";

/** Stopping, closing and clearing sessions. Methods taking a project act on its active session. */
export class SessionControl {
  constructor(
    private registry: Registry,
    private directory: WorkerDirectory,
    private runs: SessionRuns,
  ) {}

  /** Whether any of the project's sessions is working. */
  isBusy(project: string): boolean {
    return this.directory.sessionIdsOf(project).some((id) => this.runs.isRunning(id));
  }

  stop(project: string): string {
    return this.stopSession(this.directory.activeSession(project).id);
  }

  stopSession(sessionId: string): string {
    const label = this.directory.labelOf(sessionId);
    if (!this.runs.isRunning(sessionId)) return `${label} is not running.`;
    this.runs.stop(sessionId);
    return `Stopping ${label}; its queue was cleared.`;
  }

  stopAll(): void {
    this.runs.stopAll();
  }

  /** Stops the session's worker, waits for it to exit, then forgets the session entirely. */
  async closeSession(sessionId: string): Promise<string> {
    const label = this.directory.labelOf(sessionId);
    await this.runs.stopAndWait(sessionId);
    this.registry.removeSession(sessionId);
    return `Closed ${label}; its worker, queue and history are gone.`;
  }

  /** Stops the session's worker, then wipes its chat, history and conversation; the session stays open. */
  async clearSession(sessionId: string): Promise<string> {
    const label = this.directory.labelOf(sessionId);
    await this.runs.stopAndWait(sessionId);
    this.registry.clearSession(sessionId);
    return `Cleared ${label}; its next task starts a fresh conversation.`;
  }
}
