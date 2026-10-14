import type { AppEvents } from "../events/app-events.js";
import type { Projects } from "./projects.js";
import type { SessionState } from "./registry-schema.js";
import type { Sessions } from "./sessions.js";

/**
 * Which sessions each project has open and which one is active. Lives outside the model's context,
 * so hourly context resets lose nothing operational. Persisted so a restart keeps session ids.
 */
export class Registry {
  constructor(
    private projects: Projects,
    private sessions: Sessions,
    private events: AppEvents,
  ) {}

  /** Register a project added at runtime. */
  ensure(name: string, profile: string): void {
    if (this.projects.has(name)) return;
    this.projects.add({ name, profile, activeSession: "" });
    this.projects.update(name, { activeSession: this.sessions.add(name).id });
  }

  activeSession(project: string): SessionState {
    return this.sessions.session(this.projects.get(project).activeSession);
  }

  /** The project's session with this spoken number. */
  sessionByNumber(project: string, number: number): SessionState {
    return numbered(this.sessions.sessionsOf(project), project, number);
  }

  /** Opens a new, empty session and makes it the project's active one. */
  createSession(project: string): SessionState {
    const session = this.sessions.add(project);
    this.projects.update(project, { activeSession: session.id });
    return session;
  }

  activate(sessionId: string): void {
    this.projects.update(this.sessions.session(sessionId).project, { activeSession: sessionId });
  }

  /** Forgets a session and everything recorded about it. A project left with none gets a fresh one. */
  removeSession(sessionId: string): void {
    const { project } = this.sessions.session(sessionId);
    this.sessions.remove(sessionId);
    if (this.projects.get(project).activeSession === sessionId) {
      const next = this.sessions.sessionsOf(project).at(-1) ?? this.sessions.add(project);
      this.projects.update(project, { activeSession: next.id });
    }
    this.events.emitSessionRemoved(sessionId);
  }

  /** Forgets a project, its sessions and everything recorded about them. */
  removeProject(name: string): void {
    for (const { id } of this.sessions.sessionsOf(name)) {
      this.sessions.remove(id);
      this.events.emitSessionRemoved(id);
    }
    this.projects.remove(name);
  }

  /** Wipes everything recorded about a session but keeps it open, under the same number. */
  clearSession(sessionId: string): void {
    this.sessions.reset(sessionId);
    this.events.emitSessionCleared(sessionId);
  }
}

function numbered(open: SessionState[], project: string, number: number): SessionState {
  const session = open.find((s) => s.number === number);
  if (!session) throw new Error(`${project} has no session ${number}. Open: ${open.map((s) => s.number).join(", ")}`);
  return session;
}
