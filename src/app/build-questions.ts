import { QuestionBroker } from "../questions/question-broker.js";
import { QuestionReplies } from "../questions/question-replies.js";
import { WaitingQuestions } from "../questions/waiting-questions.js";
import type { Core } from "./core.js";

export interface QuestionParts {
  waiting: WaitingQuestions;
  broker: QuestionBroker;
  replies: QuestionReplies;
}

/** Workers' questions for you: they wait here until you answer them on screen. */
export function buildQuestions({ sessions, events }: Core): QuestionParts {
  const waiting = new WaitingQuestions(sessions, events);
  return { waiting, broker: new QuestionBroker(waiting), replies: new QuestionReplies(waiting, sessions) };
}
