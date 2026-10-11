import { existsSync } from "node:fs";
import type { SavedTodo } from "../limits/todo-file.js";
import type { SessionRuns } from "./session-runs.js";
import type { WorkerChat } from "./worker-chat.js";
import type { WorkerDirectory } from "./worker-directory.js";

/** Hands instructions to workers: started at once, or queued behind the session's running task. */
export class TaskIntake {
  constructor(
    private directory: WorkerDirectory,
    private runs: SessionRuns,
    private chat: WorkerChat,
  ) {}

  /** Start a task in the project's active session, or queue it if that session is busy. */
  run(project: string, instruction: string): string {
    return this.runInSession(this.directory.activeSession(project).id, instruction);
  }

  runInSession(sessionId: string, instruction: string): string {
    const project = this.directory.projectOf(sessionId);
    const label = this.directory.labelOf(sessionId);
    const path = this.directory.folderOf(project);
    if (!existsSync(path)) return `Folder for ${project} not found: ${path}`;
    this.chat.say(sessionId, "task", instruction);
    const place = this.runs.submit(sessionId, instruction);
    if (!place) return `Started on ${label} (${this.directory.accountOf(project)} account).`;
    this.chat.say(sessionId, "status", `Queued as #${place}.`);
    return `${label} is busy; queued as #${place}.`;
  }

  /** A saved todo task can run only while its project and folder still exist; otherwise it stays on the list. */
  checkSaved({ id, project }: SavedTodo): void {
    if (!this.directory.isKnown(project))
      throw new Error(`Project ${project} is no longer known; todo task ${id} kept.`);
    if (!existsSync(this.directory.folderOf(project)))
      throw new Error(`Folder for ${project} not found; todo task ${id} kept.`);
  }
}
