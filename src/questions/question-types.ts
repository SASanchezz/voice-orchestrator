import type { PermissionResult } from "@anthropic-ai/claude-agent-sdk";
import type { WorkerQuestion } from "./question-input.js";

/** Your answers by question text, as AskUserQuestion takes them; several picks are joined with ", ". */
export type AnswersByQuestion = Record<string, string>;

/** A worker's questions as they arrive, before they are waiting. */
export interface NewQuestions {
  id: string;
  session: string;
  questions: WorkerQuestion[];
  /** The tool input as the worker sent it; the answers are added to it. */
  input: Record<string, unknown>;
  resolve: (result: PermissionResult) => void;
}

/** Questions waiting for your answers; their worker is blocked until then. */
export interface PendingQuestions extends NewQuestions {
  project: string;
  createdAt: number;
}
