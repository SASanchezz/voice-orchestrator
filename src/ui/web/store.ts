// The page's state: the server's latest snapshot and what you selected. Every change re-renders the page.

import type { ProjectChangesView } from "../change-views.js";
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

/** With VS Code: code alone (chat slides over it on demand), code beside chat, or chat alone. */
export type ViewMode = "code" | "split" | "agent";

const VIEW_MODES: ViewMode[] = ["code", "split", "agent"];
const DEFAULT_VIEW_MODE: ViewMode = "code";
const VIEW_MODE_KEY = "viewMode";
const SELECTED_PROJECT_KEY = "selectedProject";
const INITIAL_STATE: UiState = {
  projects: [],
  pending: [],
  questions: [],
  permissionMode: "ask",
  speechMode: "questions",
  gestures: "unavailable", // hidden until the server says whether there is a mic
  voiceInput: "idle",
  todo: { items: [] },
  editor: "off", // no Code view until the server says VS Code is there
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
  /** True while the selected project's To-do tab is open instead of its session's chat. */
  private projectTodo = false;
  private mode = VIEW_MODES.find((known) => known === localRead(VIEW_MODE_KEY)) ?? DEFAULT_VIEW_MODE;
  /** In Code mode: the chat is slid over the editor. */
  private chatOver = false;
  /** The Review view is showing in place of the code and chat. */
  private reviewing = false;
  private changesByProject: ProjectChangesView[] = [];
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

  get projectTodoShown(): boolean {
    return this.projectTodo;
  }

  get viewMode(): ViewMode {
    return this.mode;
  }

  get chatOverlaid(): boolean {
    return this.chatOver;
  }

  get reviewShown(): boolean {
    return this.reviewing;
  }

  get changes(): ProjectChangesView[] {
    return this.changesByProject;
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

  /** A project opens on its session's chat. */
  select(projectName: string) {
    this.selectedName = projectName;
    this.projectTodo = false;
    localWrite(SELECTED_PROJECT_KEY, projectName);
    this.changed();
  }

  showProjectTodo() {
    this.projectTodo = true;
    this.changed();
  }

  showProjectChat() {
    this.projectTodo = false;
    this.changed();
  }

  setViewMode(mode: ViewMode) {
    this.mode = mode;
    this.chatOver = false;
    this.reviewing = false;
    localWrite(VIEW_MODE_KEY, mode);
    this.changed();
  }

  toggleChatOverlay() {
    this.chatOver = !this.chatOver;
    this.changed();
  }

  showReview() {
    this.reviewing = true;
    this.changed();
  }

  hideReview() {
    this.reviewing = false;
    this.changed();
  }

  /** Polled, so the page re-renders only when something really changed. */
  receiveChanges(next: ProjectChangesView[]) {
    if (JSON.stringify(next) === JSON.stringify(this.changesByProject)) return;
    this.changesByProject = next;
    this.changed();
  }

  /** Something the store doesn't hold changed, such as a file marked reviewed. */
  rerender() {
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
