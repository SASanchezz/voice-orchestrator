// What the server sends the web page. It imports only types from files that import nothing, so both the server (Node)
// and the page (browser) compile it; the server's payloads are typed against it, so the two can't drift apart unnoticed.

import type { PageTarget, ProjectTarget } from "./page-target.js";

export type SessionStatus = "idle" | "running" | "waiting_permission" | "done" | "failed" | "stopped";
export type PermissionModeName = "auto" | "ask";
export type SpeechModeName = "all" | "questions" | "muted";
/** unavailable: text mode, which has no mic for gestures to talk into. */
export type GestureStateName = "on" | "off" | "unavailable";
/** queued: your spoken message waits for the assistant to finish its current reply. */
export type VoiceInputName = "idle" | "recording" | "held" | "queued";
/** VS Code for the Code view. off: not turned on in config; starting: its first run downloads it first. */
export type EditorStateName = "off" | "starting" | "ready" | "failed";

export interface TaskRecordView {
  task: string;
  outcome: "done" | "failed" | "stopped";
  result: string;
  finishedAt: string;
}

export interface SessionView {
  id: string;
  number: number;
  status: SessionStatus;
  task?: string;
  queued: string[];
  lastActivity?: string;
  lastError?: string;
  costUsd: number;
  /** Tokens the worker's latest call read: how full its context is. */
  contextTokens?: number;
  /** Its model's context window, once a result reported it. */
  contextWindow?: number;
  history: TaskRecordView[];
}

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
  activeSession: string;
  sessions: SessionView[];
}

export interface PendingRequestView {
  id: string;
  label: string;
  description: string;
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
  voiceInput: VoiceInputName;
  voiceOffer?: VoiceOfferView;
  budget: BudgetView;
  todo: TodoListView;
  editor: EditorStateName;
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
  dictation: string; // your words so far, while the mic button records
  voice_draft: string; // your words so far, while you hold the talk key or gesture
  /** A notice's button or a spoken "show me the code": open pages switch to this view. */
  navigate: PageTarget | ProjectTarget;
}

/** Every POST answers with a message, or an error. */
export interface ActionReply {
  message?: string;
  error?: string;
}
