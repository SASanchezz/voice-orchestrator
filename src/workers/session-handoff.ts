import type { SessionState } from "../registry/registry-schema.js";
import type { HandoffWriter } from "./handoff-writer.js";
import type { SessionRuns } from "./session-runs.js";
import type { SessionSuccessor } from "./session-successor.js";

/** Moves a session whose context got large to a fresh one: the old one writes a summary, the new one starts from it. */
export class SessionHandoff {
  constructor(
    private writer: Pick<HandoffWriter, "write">,
    private runs: Pick<SessionRuns, "isRunning">,
    private successor: SessionSuccessor,
  ) {}

  async handOff(session: SessionState): Promise<string> {
    if (this.runs.isRunning(session.id))
      throw new Error(`Session ${session.number} is working; wait for it to finish or stop it, then hand it off.`);
    if (!session.claudeSessionId) throw new Error(`Session ${session.number} has no conversation to hand off yet.`);
    const summary = await this.writer.write(session);
    const next = this.successor.open(session, summary);
    return `Handed off session ${session.number} to session ${next.number}; its next task starts from the summary.`;
  }
}
