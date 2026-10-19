// The page's state: the server's latest snapshot and what you selected. Every change re-renders the page.

import type { ProjectView, SessionStatus, SessionView, UiState } from "../protocol.js";
import { localRead, localWrite } from "./dom.js";

export const STATUS_LABELS: Record<SessionStatus, string> = {
  idle: "idle",
  running: "running",
  waiting_permission: "waiting for you",
  done: "done",
  failed: "failed",
  stopped: "stopped",
};

const SELECTED_PROJECT_KEY = "selectedProject";
const INITIAL_STATE: UiState = {
  projects: [],
  pending: [],
  questions: [],
  permissionMode: "ask",
  speechMode: "questions",
  voiceInput: "idle",
  todo: { items: [] },
  // nothing is marked until the server's first state brings the real limits
  budget: {
    contextWarnPercent: Number.POSITIVE_INFINITY,
    contextCriticalPercent: Number.POSITIVE_INFINITY,
    sessionCostUsd: Number.POSITIVE_INFINITY,
    dailyCostUsd: Number.POSITIVE_INFINITY,
    spentTodayUsd: 0,
  },
};

class PageStore {
  private snapshot = INITIAL_STATE;
  /** Empty: the orchestrator's own chat is selected. */
  private selectedName = localRead(SELECTED_PROJECT_KEY) ?? "";
  /** True while the assistant writes its summary; its chat empties once that is saved. */
  private clearing = false;
  private listeners: (() => void)[] = [];

  get state(): UiState {
    return this.snapshot;
  }

  get selectedProjectName(): string {
    return this.selectedName;
  }

  get clearingAssistant(): boolean {
    return this.clearing;
  }

  /** The selected project, or undefined when the assistant's chat is selected. */
  selectedProject(): ProjectView | undefined {
    return this.snapshot.projects.find((p) => p.name === this.selectedName);
  }

  onChange(listener: () => void) {
    this.listeners.push(listener);
  }

  receive(next: UiState) {
    this.snapshot = next;
    this.changed();
  }

  select(projectName: string) {
    this.selectedName = projectName;
    localWrite(SELECTED_PROJECT_KEY, projectName);
    this.changed();
  }

  setClearingAssistant(clearing: boolean) {
    this.clearing = clearing;
    this.changed();
  }

  private changed() {
    this.listeners.forEach((listener) => listener());
  }
}

/** The one store of the page. */
export const store = new PageStore();

export function activeSession(project: ProjectView): SessionView {
  const session = project.sessions.find((s) => s.id === project.activeSession);
  if (!session) throw new Error(`${project.name} has no active session`);
  return session;
}
