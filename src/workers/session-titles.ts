import type { Sessions } from "../registry/sessions.js";
import { errorMessage } from "../shared/errors.js";
import type { TitleWriter } from "./title-writer.js";
import type { SessionMessage, WorkerChat } from "./worker-chat.js";

/** Gives each new session a short title from its first task, written in the background; the tab shows the task until then. */
export class SessionTitles {
  private writing = new Set<string>();

  constructor(
    private writer: Pick<TitleWriter, "write">,
    private sessions: Sessions,
  ) {}

  follow(chat: WorkerChat): void {
    chat.on("message", (message: SessionMessage) => {
      if (message.kind === "task") void this.nameIfNew(message.session, message.text);
    });
  }

  /** Resolves once the title is saved, or skipped; a failure only leaves the tab showing the task. */
  async nameIfNew(sessionId: string, task: string): Promise<void> {
    if (!this.isUntitled(sessionId)) return;
    this.writing.add(sessionId);
    try {
      await this.name(sessionId, task);
    } catch (error) {
      console.error(`[titles] session ${sessionId} not titled: ${errorMessage(error)}`);
    } finally {
      this.writing.delete(sessionId);
    }
  }

  private isUntitled(sessionId: string): boolean {
    if (this.writing.has(sessionId) || !this.sessions.hasSession(sessionId)) return false;
    const session = this.sessions.session(sessionId);
    return !session.title && session.history.length === 0;
  }

  private async name(sessionId: string, task: string): Promise<void> {
    const title = await this.writer.write(this.sessions.session(sessionId).project, task);
    if (this.sessions.hasSession(sessionId)) this.sessions.updateSession(sessionId, { title });
  }
}
