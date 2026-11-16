import type { Sessions } from "../registry/sessions.js";
import { errorMessage } from "../shared/errors.js";
import type { HeadlineWriter } from "./headline-writer.js";
import type { RunningTask } from "./running-task.js";

/** The announcement waits this long for its headline, then names the session's title instead. */
const HEADLINE_WAIT_MS = 15_000;

/** What a finished task's work was about, for its announcement; undefined leaves it to the task's opening words. */
export interface TaskTopics {
  topicOf(task: RunningTask, closingNote: string): Promise<string | undefined>;
}

/** Names nothing, so announcements use the task's opening words and no model is asked. */
export const UNNAMED_TOPICS: TaskTopics = { topicOf: () => Promise.resolve(undefined) };

/** A headline a small model writes from the task and its closing note, else the session's title. */
export class WrittenTopics implements TaskTopics {
  constructor(
    private writer: Pick<HeadlineWriter, "write">,
    private sessions: Sessions,
  ) {}

  async topicOf(task: RunningTask, closingNote: string): Promise<string | undefined> {
    try {
      return await WrittenTopics.withinWait(this.writer.write(task.project, task.instruction, closingNote));
    } catch (error) {
      console.error(`[headlines] session ${task.sessionId} not headlined: ${errorMessage(error)}`);
      return this.titleOf(task.sessionId);
    }
  }

  private titleOf(sessionId: string): string | undefined {
    if (!this.sessions.hasSession(sessionId)) return undefined;
    return this.sessions.session(sessionId).title;
  }

  private static withinWait(headline: Promise<string>): Promise<string> {
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("headline took too long")), HEADLINE_WAIT_MS);
    });
    return Promise.race([headline, late]).finally(() => clearTimeout(timer));
  }
}
