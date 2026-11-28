import type { SessionState } from "../registry/registry-schema.js";
import type { CompactionNotes } from "./compaction-notes.js";
import { type ContextCompactor, compactCommand } from "./context-compactor.js";
import type { SessionRuns } from "./session-runs.js";

/** Shrinks an idle session's context without leaving it: the conversation goes on from a summary of itself. */
export class SessionCompaction {
  constructor(
    private compactor: Pick<ContextCompactor, "compact">,
    private runs: Pick<SessionRuns, "isRunning" | "runAlone">,
    private notes: Pick<CompactionNotes, "started" | "done" | "failed" | "stopped">,
  ) {}

  /** `focus` says what the summary should keep; tasks sent while it compacts queue behind it, as behind a task. */
  async compact(session: SessionState, focus?: string): Promise<string> {
    if (this.runs.isRunning(session.id))
      throw new Error(`Session ${session.number} is working; wait for it to finish or stop it, then compact it.`);
    if (!session.claudeSessionId) throw new Error(`Session ${session.number} has no conversation to compact yet.`);
    return this.runs.runAlone(session.id, (abort) => this.compactAndNote(session, compactCommand(focus), abort));
  }

  /** Noted before the session is free again, so a task waiting behind it resumes the compacted conversation. */
  private async compactAndNote(session: SessionState, command: string, abort: AbortController): Promise<string> {
    this.notes.started(session);
    try {
      return this.notes.done(session, await this.compactor.compact(session, command, abort));
    } catch (error) {
      throw this.noteFailure(session, error, abort);
    }
  }

  private noteFailure(session: SessionState, error: unknown, abort: AbortController): unknown {
    if (abort.signal.aborted) this.notes.stopped(session);
    else this.notes.failed(session, error);
    return error;
  }
}
