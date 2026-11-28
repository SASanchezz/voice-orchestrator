import { errorMessage } from "../shared/errors.js";
import type { SideQuestionWriter } from "./side-question-writer.js";
import type { WorkerChat } from "./worker-chat.js";
import type { WorkerDirectory } from "./worker-directory.js";
import { SIDE_QUESTION_PREFIX } from "./side-question-prefix.js";

/** /btw questions: answered in the session's chat, without queueing behind or interrupting its task. */
export class SideQuestions {
  constructor(
    private directory: WorkerDirectory,
    private writer: Pick<SideQuestionWriter, "answer">,
    private chat: WorkerChat,
  ) {}

  /** Shows the question in the session's chat and starts answering it; the answer arrives there later. */
  ask(sessionId: string, line: string, question: string): string {
    const failed = (e: unknown): void => this.chat.sayFailure(sessionId, errorMessage(e));
    this.answerInChat(sessionId, line, question).catch(failed);
    return `Answering the side question on ${this.directory.labelOf(sessionId)}.`;
  }

  /** For the assistant: the answer shows in the session's chat and comes back, to be read out. */
  answer(sessionId: string, question: string): Promise<string> {
    return this.answerInChat(sessionId, `${SIDE_QUESTION_PREFIX} ${question}`, question);
  }

  private async answerInChat(sessionId: string, line: string, question: string): Promise<string> {
    this.chat.say(sessionId, "task", line);
    const answer = await this.writer.answer(this.directory.newTask(sessionId, { instruction: question }));
    this.chat.say(sessionId, "aside", answer);
    return answer;
  }
}
