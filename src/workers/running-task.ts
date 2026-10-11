/** A task as its worker starts it: where it runs, on which account, and the conversation it resumes. */
export interface RunningTask {
  sessionId: string;
  project: string;
  sessionNumber: number;
  instruction: string;
  /** The project's account; it can't change while the project is busy. */
  account: string;
  /** Claude Code's own session id, if the session has talked before. */
  resume?: string;
}
