import { errorMessage } from "../shared/errors.js";
import type { SideQuestionWriter } from "./side-question-writer.js";
import type { WorkerChat } from "./worker-chat.js";
import type { WorkerDirectory } from "./worker-directory.js";

/** /btw questions: answered in the session's chat at once, without queueing behind or interrupting its task. */
export class SideQuestions {
  constructor(
    private directory: WorkerDirectory,
    private writer: Pick<SideQuestionWriter, "answer">,
    private chat: WorkerChat,
  ) {}

  /** Shows the question in the session's chat and starts answering it; the answer arrives there later. */
  ask(sessionId: string, line: string, question: string): string {
    this.chat.say(sessionId, "task", line);
    void this.answer(sessionId, question);
    return `Answering the side question on ${this.directory.labelOf(sessionId)}.`;
  }

  private async answer(sessionId: string, question: string): Promise<void> {
    try {
      await this.postAnswer(sessionId, question);
    } catch (e) {
      this.chat.sayFailure(sessionId, errorMessage(e));
    }
  }

  private async postAnswer(sessionId: string, question: string): Promise<void> {
    const task = this.directory.newTask(sessionId, { instruction: question });
    this.chat.say(sessionId, "reply", await this.writer.answer(task));
  }
}
