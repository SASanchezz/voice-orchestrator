// What the server sends the web page. It imports only types from files that import nothing, so both the server (Node)
// and the page (browser) compile it; the server's payloads are typed against it, so the two can't drift apart unnoticed.

import type { NoticeView } from "./notice-protocol.js";
import type { NavigationTarget } from "./page-target.js";
import type { SessionView } from "./session-protocol.js";
import type { VoiceBoxNews } from "./voice-box-protocol.js";

export type { SessionStatus, SessionView, TaskRecordView } from "./session-protocol.js";
export type PermissionModeName = "auto" | "ask";
export type SpeechModeName = "all" | "questions" | "muted";
/** unavailable: text mode, which has no mic for gestures to talk into. */
export type GestureStateName = "on" | "off" | "unavailable";
/** unavailable: text mode, which has no mic to listen on. */
export type WakeWordStateName = "on" | "off" | "unavailable";
/** queued: your spoken message waits for the assistant to finish its current reply. */
export type VoiceInputName = "idle" | "recording" | "held" | "queued";
/** VS Code for the Code view. off: not in config; starting: its first run downloads it; restarting: asked from the page. */
export type EditorStateName = "off" | "starting" | "ready" | "failed" | "restarting";

/** The limits from config.yaml's budget, and what all sessions spent today. */
export interface BudgetView {
  contextWarnPercent: number;
  contextCriticalPercent: number;
  sessionCostUsd: number;
  dailyCostUsd: number;
  spentTodayUsd: number;
}

export interface ProjectView {
  name: string;
  profile: string;
  /** The project's folder on this machine. */
  folder: string;
  /** The same folder with your home folder written as ~. */
  folderFromHome: string;
  /** The worker model config.yaml sets for the project; unset, Claude Code's default. */
  model?: string;
  /** The model Claude Code's own settings pick when config.yaml names none; unset, Claude Code's built-in one. */
  claudeModel?: string;
  /** The Chrome profile its links open in; unset, they open beside the web UI. */
  chromeProfile?: string;
  activeSession: string;
  sessions: SessionView[];
}

export interface PendingRequestView {
  id: string;
  label: string;
  description: string;
  /** The whole tool call; `description` is cut at a few hundred characters. */
  command: string;
  destructiveVerb?: string;
  explanation?: string;
  explaining: boolean;
  createdAt: number;
}

export interface QuestionOptionView {
  label: string;
  /** What picking it means. */
  description: string;
}

/** One question a worker asks, with its proposed answers; you may also answer in your own words. */
export interface QuestionView {
  question: string;
  /** A short chip such as "Database". */
  header: string;
  /** True when several options may be picked. */
  multiSelect: boolean;
  options: QuestionOptionView[];
}

/** A worker's questions, waiting for your answers; it continues once they're sent. */
export interface PendingQuestionView {
  id: string;
  session: string;
  label: string;
  questions: QuestionView[];
  createdAt: number;
}

/** A wake word training going on in the background. */
export interface WakeTrainingView {
  /** Epoch ms. */
  startedAt: number;
  /** The last progress line it printed; empty until the first. */
  step: string;
}

/** Your voice message, waiting while you choose whether the files in the draft go with it. */
export interface VoiceOfferView {
  id: string;
  text: string;
}

export interface UiState {
  projects: ProjectView[];
  pending: PendingRequestView[];
  questions: PendingQuestionView[];
  permissionMode: PermissionModeName;
  speechMode: SpeechModeName;
  /** Camera gestures; off means the camera isn't used at all. */
  gestures: GestureStateName;
  /** The wake word, switched apart from gestures; off means the mic is open only while you talk. */
  wakeWord: WakeWordStateName;
  /** Set while the wake word trains in the background: no other training, recording or deletion until it ends. */
  wakeTraining?: WakeTrainingView;
  voiceInput: VoiceInputName;
  voiceOffer?: VoiceOfferView;
  /** The confirm phrases the assistant asked you to say, e.g. ["push"]; Confirm buttons answer them. */
  confirmVerbs: string[];
  /** The assistant asked a yes-or-no go-ahead question; Yes and Cancel buttons answer it. */
  goAheadAsked: boolean;
  budget: BudgetView;
  todo: TodoListView;
  editor: EditorStateName;
  notices: NoticeView[];
}

/** An item on your personal to-do list. */
export interface TodoItemView {
  id: number;
  title: string;
  description: string;
  project?: string;
  done: boolean;
  /** ISO time. */
  createdAt: string;
  /** Where it was sent, oldest first; the page reads each run's progress off its session. */
  runs: TodoRunView[];
}

/** One time a to-do item was sent to a worker session. */
export interface TodoRunView {
  project: string;
  sessionId: string;
  /** The task as sent, which tells it apart from the session's other tasks. */
  instruction: string;
  /** ISO time. */
  sentAt: string;
}

export interface TodoListView {
  /** Oldest first. */
  items: TodoItemView[];
  /** The item deleted last, which Undo brings back. */
  lastDeleted?: TodoItemView;
}

/** A worker session an assistant's line is about or relays an answer from; the page links to it. */
export interface SessionLinkView {
  project: string;
  id: string;
  number: number;
}

/** A line of the assistant's chat. */
export interface FeedEntryView {
  id: number;
  at: string;
  kind: "user" | "orchestrator" | "event" | "action";
  text: string;
  about?: string;
  source?: "voice" | "ui";
  failed?: boolean;
  detail?: string;
  taskOutcome?: "done" | "failed";
  session?: SessionLinkView;
}

/** A line of one worker session's chat. */
export interface ChatMessageView {
  id: number;
  at: string;
  kind: "task" | "reply" | "tool" | "status" | "permission" | "question";
  text: string;
  failed?: boolean;
  /** A tool call's own id, so a sub-agent it started can point at it. */
  toolUseId?: string;
  /** Set on a sub-agent's lines: the tool call that started it. */
  parentToolUseId?: string;
}

export interface SessionChatLine {
  session: string;
  message: ChatMessageView;
}

/** Server-sent events by name, with their payloads. */
export interface ServerEvents {
  state: UiState;
  backlog: FeedEntryView[];
  feed: FeedEntryView;
  chat: SessionChatLine;
  chat_cleared: string;
  voice_box: VoiceBoxNews; // the recording a page's message box follows, however it was started
  /** A notice's button or a spoken "show me the code": open pages switch to this view. */
  navigate: NavigationTarget;
}

/** Every POST answers with a message, or an error. */
export interface ActionReply {
  message?: string;
  error?: string;
}
