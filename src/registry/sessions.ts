import { randomUUID } from "node:crypto";
import type { SessionPatch, SessionState } from "./registry-schema.js";
import { emptySession } from "./session-records.js";

/** Every open worker session, of all projects. */
export class Sessions {
  constructor(
    private byId: Map<string, SessionState>,
    private save: () => void,
  ) {}

  session(id: string): SessionState {
    const session = this.byId.get(id);
    if (!session) throw new Error(`unknown session "${id}"`);
    return session;
  }

  hasSession(id: string): boolean {
    return this.byId.has(id);
  }

  sessionsOf(project: string): SessionState[] {
    return [...this.byId.values()].filter((s) => s.project === project);
  }

  updateSession(id: string, patch: SessionPatch): void {
    Object.assign(this.session(id), patch);
    this.save();
  }

  /** How to name a session aloud: just the project while it has one session. */
  labelOf(id: string): string {
    const { project, number } = this.session(id);
    return this.sessionsOf(project).length > 1 ? `${project} session ${number}` : project;
  }

  /** Not saved yet: the new session is saved once it is made the project's active one. */
  add(project: string): SessionState {
    const number = Math.max(0, ...this.sessionsOf(project).map((s) => s.number)) + 1;
    const session = emptySession(randomUUID(), project, number);
    this.byId.set(session.id, session);
    return session;
  }

  remove(id: string): void {
    this.byId.delete(id);
    this.save();
  }

  /** Wipes everything recorded about a session but keeps it open, under the same number. */
  reset(id: string): void {
    const { project, number } = this.session(id);
    this.byId.set(id, emptySession(id, project, number));
    this.save();
  }
}
