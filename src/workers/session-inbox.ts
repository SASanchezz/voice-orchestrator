import type { QueuedTask } from "./queued-task.js";
import { SIDE_QUESTION_PREFIX } from "./side-question-prefix.js";
import type { SideQuestions } from "./side-questions.js";
import type { TaskIntake } from "./task-intake.js";

const SIDE_QUESTION = new RegExp(String.raw`^${SIDE_QUESTION_PREFIX}(?:\s+|$)`, "i");

/** What you send a session yourself: a /btw side question, or a task it starts or queues. */
export class SessionInbox {
  constructor(
    private intake: Pick<TaskIntake, "runInSession" | "runOnModel">,
    private sideQuestions: Pick<SideQuestions, "ask">,
  ) {}

  send(sessionId: string, task: QueuedTask): string {
    if (SIDE_QUESTION.test(task.instruction)) return this.askAside(sessionId, task.instruction);
    if (task.model) return this.intake.runOnModel(sessionId, task.instruction, task.model);
    return this.intake.runInSession(sessionId, task.instruction);
  }

  private askAside(sessionId: string, line: string): string {
    const question = line.replace(SIDE_QUESTION, "").trim();
    if (!question) return "Add a question after /btw.";
    return this.sideQuestions.ask(sessionId, line, question);
  }
}
