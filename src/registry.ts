import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { STATE_DIR } from "./config.js";

const HISTORY_PER_SESSION = 10;
const HISTORY_RESULT_CHARS = 1500;
const RECENT_TASKS_IN_PROMPT = 3;
const RECENT_RESULT_CHARS = 240;
const FILE_VERSION = 2;

export type ProjectStatus = "idle" | "running" | "waiting_permission" | "done" | "failed" | "stopped";

export interface ProjectState {
  name: string;
  profile: string;
  /** Session that gets the project's tasks unless one is named. */
  activeSession: string;
}

/** One worker conversation inside a project, like a Claude Code tab in VS Code. */
export interface SessionState {
  id: string;
  project: string;
  /** Spoken and shown as "session 2"; unique among the project's open sessions. */
  number: number;
  status: ProjectStatus;
  /** Claude Code's own session id, resumed by the next task. */
  claudeSessionId?: string;
  task?: string;
  queued: string[];
  lastResult?: string;
  lastError?: string;
  startedAt?: string;
  finishedAt?: string;
  lastActivity?: string; // last tool the worker used, for "what is it doing" questions
  costUsd: number;
  history: TaskRecord[];
}

/** A finished task, kept across restarts so you can refer back to earlier work. */
export interface TaskRecord {
  task: string;
  outcome: "done" | "failed" | "stopped";
  result: string;
  finishedAt: string;
}

/** Who an event is about: the session, and how to name it aloud ("webshop" or "webshop session 2"). */
interface EventSubject {
  project: string;
  session: string;
  label: string;
}

/** Which task ended, so its announcement can name the session and say what it was about. */
interface TaskSubject {
  task: string;
  sessionNumber: number;
}

/** Events the orchestrator turns into speech. */
export type AppEvent = EventSubject &
  (
    | (TaskSubject & { kind: "task_done"; result: string })
    | (TaskSubject & { kind: "task_failed"; error: string })
    | { kind: "permission"; id: string; description: string; destructiveVerb?: string; reminder?: boolean }
  );

interface SavedState {
  version: typeof FILE_VERSION;
  projects: Record<string, ProjectState>;
  sessions: Record<string, SessionState>;
}

/** Shape of registry.json before sessions: one worker conversation per project. */
interface LegacyProject {
  profile: string;
  sessionId?: string;
  lastResult?: string;
  costUsd?: number;
  history?: TaskRecord[];
  status?: ProjectStatus;
}

/**
 * Source of truth for project/session state. Lives outside the model's context,
 * so hourly context resets lose nothing operational. Persisted so a restart keeps session ids.
 */
export class Registry extends EventEmitter {
  private file = resolve(STATE_DIR, "registry.json");
  private projects = new Map<string, ProjectState>();
  private sessions = new Map<string, SessionState>();

  constructor(projectProfiles: Record<string, string>) {
    super();
    mkdirSync(STATE_DIR, { recursive: true });
    const saved = this.load();
    for (const [name, profile] of Object.entries(projectProfiles)) {
      const prev = saved.projects[name];
      const sessions = Object.values(saved.sessions).filter((s) => s.project === name);
      if (!prev || !sessions.length) {
        this.addProject(name, prev?.profile ?? profile);
        continue;
      }
      for (const s of sessions) this.sessions.set(s.id, restored(s));
      const activeSession = this.sessions.has(prev.activeSession) ? prev.activeSession : sessions[0].id;
      this.projects.set(name, { name, profile: prev.profile, activeSession });
    }
  }

  /** Register a project added at runtime. */
  ensure(name: string, profile: string) {
    if (this.projects.has(name)) return;
    this.addProject(name, profile);
    this.persist();
  }

  get(name: string): ProjectState {
    const p = this.projects.get(name);
    if (!p) throw new Error(`unknown project "${name}"`);
    return p;
  }

  all(): ProjectState[] {
    return [...this.projects.values()];
  }

  update(name: string, patch: Partial<Omit<ProjectState, "name">>) {
    Object.assign(this.get(name), patch);
    this.persist();
  }

  // ---------------------------------------------------------------- sessions

  session(id: string): SessionState {
    const s = this.sessions.get(id);
    if (!s) throw new Error(`unknown session "${id}"`);
    return s;
  }

  hasSession(id: string): boolean {
    return this.sessions.has(id);
  }

  allSessions(): SessionState[] {
    return [...this.sessions.values()];
  }

  sessionsOf(project: string): SessionState[] {
    return this.allSessions().filter((s) => s.project === project);
  }

  activeSession(project: string): SessionState {
    return this.session(this.get(project).activeSession);
  }

  /** The project's session with this spoken number. */
  sessionByNumber(project: string, number: number): SessionState {
    const s = this.sessionsOf(project).find((x) => x.number === number);
    if (!s) throw new Error(`${project} has no session ${number}. Open: ${this.sessionsOf(project).map((x) => x.number).join(", ")}`);
    return s;
  }

  /** Opens a new, empty session and makes it the project's active one. */
  createSession(project: string): SessionState {
    const session = this.addSession(project);
    this.get(project).activeSession = session.id;
    this.persist();
    return session;
  }

  activate(sessionId: string) {
    const { project } = this.session(sessionId);
    this.update(project, { activeSession: sessionId });
  }

  /** Forgets a session and everything recorded about it. A project left with none gets a fresh one. */
  removeSession(sessionId: string) {
    const { project } = this.session(sessionId);
    this.sessions.delete(sessionId);
    const owner = this.get(project);
    if (owner.activeSession === sessionId) owner.activeSession = (this.sessionsOf(project).at(-1) ?? this.addSession(project)).id;
    this.persist();
    this.emit("session_removed", sessionId);
  }

  /** Wipes everything recorded about a session but keeps it open, under the same number. */
  clearSession(sessionId: string) {
    const { id, project, number } = this.session(sessionId);
    this.sessions.set(id, emptySession(id, project, number));
    this.persist();
    this.emit("session_cleared", sessionId);
  }

  updateSession(id: string, patch: Partial<Omit<SessionState, "id" | "project" | "number">>) {
    Object.assign(this.session(id), patch);
    this.persist();
  }

  recordTask(sessionId: string, record: Omit<TaskRecord, "finishedAt">) {
    const entry = { ...record, result: record.result.slice(-HISTORY_RESULT_CHARS), finishedAt: new Date().toISOString() };
    this.updateSession(sessionId, { history: [...this.session(sessionId).history, entry].slice(-HISTORY_PER_SESSION) });
  }

  /** How to name a session aloud: just the project while it has one session. */
  labelOf(sessionId: string): string {
    const s = this.session(sessionId);
    return this.sessionsOf(s.project).length > 1 ? `${s.project} session ${s.number}` : s.project;
  }

  // ---------------------------------------------------------------- reports

  /** Full task history of one project across its open sessions, newest last. */
  historyOf(name: string): string {
    const history = this.projectHistory(name);
    if (!history.length) return `No finished tasks recorded for ${name}.`;
    return history.map((h) => `${h.finishedAt.slice(0, 16)} [${h.outcome}] ${h.task}\nResult: ${h.result}`).join("\n\n");
  }

  /** The last few tasks per project, short enough for a system prompt. */
  recentWork(): string {
    return this.all()
      .map((p) => [p.name, this.projectHistory(p.name)] as const)
      .filter(([, history]) => history.length)
      .map(([name, history]) =>
        `${name}:\n` +
        history
          .slice(-RECENT_TASKS_IN_PROMPT)
          .map((h) => `- ${h.finishedAt.slice(0, 16)} [${h.outcome}] ${h.task.slice(0, 120)} -> ${h.result.slice(-RECENT_RESULT_CHARS)}`)
          .join("\n"),
      )
      .join("\n");
  }

  /** One project's open sessions, for the list_sessions tool. */
  sessionList(project: string): string {
    const active = this.get(project).activeSession;
    return this.sessionsOf(project)
      .map((s) => `session ${s.number}${s.id === active ? " (active)" : ""}: ${describeSession(s)}`)
      .join("\n");
  }

  emitEvent(e: AppEvent) {
    this.emit("event", e);
  }

  /** Compact text snapshot for the orchestrator (and for handoffs). */
  snapshot(): string {
    return this.all()
      .map((p) => {
        const sessions = this.sessionsOf(p.name);
        if (sessions.length === 1) return `${p.name} [${p.profile}]: ${describeSession(sessions[0])}`;
        return `${p.name} [${p.profile}], ${sessions.length} sessions:\n` + this.sessionList(p.name).replace(/^/gm, "  ");
      })
      .join("\n");
  }

  // ---------------------------------------------------------------- internals

  private projectHistory(name: string): TaskRecord[] {
    return this.sessionsOf(name)
      .flatMap((s) => s.history)
      .sort((a, b) => a.finishedAt.localeCompare(b.finishedAt));
  }

  private addProject(name: string, profile: string) {
    this.projects.set(name, { name, profile, activeSession: "" });
    this.get(name).activeSession = this.addSession(name).id;
  }

  private addSession(project: string): SessionState {
    const number = Math.max(0, ...this.sessionsOf(project).map((s) => s.number)) + 1;
    const session = emptySession(randomUUID(), project, number);
    this.sessions.set(session.id, session);
    return session;
  }

  private load(): SavedState {
    const empty: SavedState = { version: FILE_VERSION, projects: {}, sessions: {} };
    if (!existsSync(this.file)) return empty;
    const saved = JSON.parse(readFileSync(this.file, "utf8")) as SavedState | Record<string, LegacyProject>;
    return saved.version === FILE_VERSION ? (saved as SavedState) : fromLegacy(saved as Record<string, LegacyProject>);
  }

  private persist() {
    const saved: SavedState = {
      version: FILE_VERSION,
      projects: Object.fromEntries(this.projects),
      sessions: Object.fromEntries(this.sessions),
    };
    writeFileSync(this.file, JSON.stringify(saved, null, 2));
  }
}

function emptySession(id: string, project: string, number: number): SessionState {
  return { id, project, number, status: "idle", queued: [], costUsd: 0, history: [] };
}

function describeSession(s: SessionState): string {
  const bits = [s.status as string];
  if (s.task) bits.push(`task="${s.task.slice(0, 120)}"`);
  if (s.queued.length) bits.push(`${s.queued.length} queued`);
  if (s.lastActivity && s.status === "running") bits.push(`now: ${s.lastActivity}`);
  if (s.lastError && s.status === "failed") bits.push(`error: ${s.lastError.slice(0, 160)}`);
  return bits.join(", ");
}

/** A saved session after a restart: anything that was mid-run when we died is not running anymore. */
function restored(s: SessionState): SessionState {
  const wasRunning = ["running", "waiting_permission"].includes(s.status);
  return { ...s, status: wasRunning ? "stopped" : s.status, queued: [], lastActivity: undefined };
}

/** Each pre-sessions project becomes a project with one session carrying its old state. */
function fromLegacy(legacy: Record<string, LegacyProject>): SavedState {
  const state: SavedState = { version: FILE_VERSION, projects: {}, sessions: {} };
  for (const [name, old] of Object.entries(legacy)) {
    const id = randomUUID();
    state.projects[name] = { name, profile: old.profile, activeSession: id };
    state.sessions[id] = {
      id,
      project: name,
      number: 1,
      status: old.status ?? "idle",
      claudeSessionId: old.sessionId,
      lastResult: old.lastResult,
      queued: [],
      costUsd: old.costUsd ?? 0,
      history: old.history ?? [],
    };
  }
  return state;
}
