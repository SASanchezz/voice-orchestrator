import { randomUUID } from "node:crypto";
import type { ProjectState, SavedRegistry, SessionState } from "./registry-schema.js";
import { afterRestart, emptySession } from "./session-records.js";

/**
 * The projects in config, with their saved sessions where there are any.
 * A project without saved sessions starts with one fresh session; saved projects no longer in config are dropped.
 */
export class RestoredRegistry {
  readonly projects = new Map<string, ProjectState>();
  readonly sessions = new Map<string, SessionState>();

  constructor(private saved: SavedRegistry) {}

  restore(name: string, profile: string): void {
    const previous = this.saved.projects[name];
    const sessions = Object.values(this.saved.sessions).filter((s) => s.project === name);
    if (!previous || !sessions.length) return this.addFresh(name, previous?.profile ?? profile);
    for (const session of sessions) this.sessions.set(session.id, afterRestart(session));
    const activeSession = this.sessions.has(previous.activeSession) ? previous.activeSession : sessions[0].id;
    this.projects.set(name, { name, profile: previous.profile, activeSession });
  }

  private addFresh(name: string, profile: string): void {
    const session = emptySession(randomUUID(), name, 1);
    this.sessions.set(session.id, session);
    this.projects.set(name, { name, profile, activeSession: session.id });
  }
}
