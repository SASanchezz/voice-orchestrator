// What the server sends the web page. It imports only types from files that import nothing, so both the server (Node)
// and the page (browser) compile it; the server's payloads are typed against it, so the two can't drift apart unnoticed.

import type { PageTarget } from "./page-target.js";

export type SessionStatus = "idle" | "running" | "waiting_permission" | "done" | "failed" | "stopped";
export type PermissionModeName = "auto" | "ask";
export type SpeechModeName = "all" | "questions" | "muted";
export type VoiceInputName = "idle" | "recording" | "held";

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
  history: TaskRecordView[];
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

export interface UiState {
  projects: ProjectView[];
  pending: PendingRequestView[];
  questions: PendingQuestionView[];
  permissionMode: PermissionModeName;
  speechMode: SpeechModeName;
  voiceInput: VoiceInputName;
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
  /** A notice's button: open pages switch to this view. */
  navigate: PageTarget;
}

/** Every POST answers with a message, or an error. */
export interface ActionReply {
  message?: string;
  error?: string;
}
