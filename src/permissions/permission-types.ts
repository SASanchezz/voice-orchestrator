import type { PermissionResult, PermissionUpdate } from "@anthropic-ai/claude-agent-sdk";
import type { DestructiveRule } from "../safety/destructive-rules-file.js";

export type Decision = "once" | "always" | "deny";

/** Plain-language explanation of a worker's command, for the approval card. */
export type ExplainCommand = (project: string, command: string) => Promise<string>;

/** A tool call a worker wants to make. */
export interface ToolCall {
  toolName: string;
  input: Record<string, unknown>;
}

/** What the SDK passes along with a permission request. */
export interface RequestContext {
  suggestions?: PermissionUpdate[];
  signal: AbortSignal;
}

/** A request as it arrives, before it is waiting. */
export interface NewRequest {
  id: string;
  session: string;
  call: ToolCall;
  destructive?: DestructiveRule;
  suggestions?: PermissionUpdate[];
  /** True when a plain-language explanation is being written for it. */
  explaining: boolean;
  resolve: (result: PermissionResult) => void;
}

/** A request waiting for your answer; its worker is blocked until then. */
export interface Pending extends Omit<NewRequest, "call"> {
  project: string;
  description: string;
  explanation?: string;
  createdAt: number;
  reminder: NodeJS.Timeout;
}

/** A waiting request as the UI shows it. */
export interface PendingRequest {
  id: string;
  project: string;
  session: string;
  sessionNumber: number;
  /** How the UI names the asker: the project, plus the session number when it has several. */
  label: string;
  description: string;
  destructiveVerb?: string;
  /** What the command will do and how risky it is, in plain words; once it has been written. */
  explanation?: string;
  /** True while the explanation is being written. */
  explaining: boolean;
  createdAt: number;
}

/** A waiting request in the form the model reads. */
export interface PendingForModel {
  id: string;
  project: string;
  request: string;
  destructive: string;
  waitingSeconds: number;
}
