import type { AppEvent, AppEvents, QuestionEvent } from "../events/app-events.js";
import type { WorkerQuestion } from "../questions/question-input.js";
import type { AnswersByQuestion } from "../questions/question-types.js";
import type { PopupActions } from "./popup-actions.js";
import type { NoticeButton } from "./task-notices.js";

/** What a pop-up shows for a worker's questions: buttons top to bottom, and maybe a field for your own answer. */
export interface QuestionPanel {
  title: string;
  detail: string;
  buttons: NoticeButton[];
  acceptsText: boolean;
}

/** One open question pop-up. */
export interface OpenPanel {
  close(): void;
}

/** Shows native question pop-ups; `chosen` gets a button's answer, or "text:<your words>". */
export interface QuestionPanelDevice {
  ask(panel: QuestionPanel, chosen: (answer: string) => void): OpenPanel;
}

/** Answers questions as a click in the web UI's dialog does. */
export interface QuestionClicks {
  answerByClick(id: string, answers: AnswersByQuestion): string;
}

const OPEN_BROWSER: NoticeButton = { answer: "open", label: "Open in browser" };
const OPTION_ANSWER = /^option:(\d+)$/;
const TEXT_ANSWER = /^text:(.+)$/;

/**
 * A native pop-up for each worker's questions, so you see them from any app; it closes once they're answered anywhere.
 * One question with a single pick is answered right there; anything more opens the web UI's dialog.
 * Any click on it stops the spoken "… has a question", and drops it if it is still queued.
 */
export class QuestionPopups {
  private open = new Map<string, OpenPanel>();

  constructor(
    private device: QuestionPanelDevice,
    private clicks: QuestionClicks,
    private actions: PopupActions,
  ) {}

  follow(events: AppEvents): void {
    events.on("event", (e: AppEvent) => {
      if (e.kind === "question") this.show(e);
    });
    events.on("question_closed", (id: string) => this.close(id));
  }

  private show(asked: QuestionEvent): void {
    this.open.set(
      asked.id,
      this.device.ask(panelFor(asked), (answer) => this.chosen(asked, answer)),
    );
  }

  private chosen(asked: QuestionEvent, answer: string): void {
    this.actions.silence(asked);
    if (answer === OPEN_BROWSER.answer)
      return void this.actions.openPage({ view: "session", sessionId: asked.session });
    const [question] = asked.questions;
    const given = answerFrom(question, answer);
    if (given) this.clicks.answerByClick(asked.id, { [question.question]: given });
  }

  private close(id: string): void {
    this.open.get(id)?.close();
    this.open.delete(id);
  }
}

function panelFor({ label, questions }: QuestionEvent): QuestionPanel {
  const [first] = questions;
  const single = questions.length === 1;
  const title = single ? `${label} asks: ${first.question}` : `${label} has ${questions.length} questions`;
  const detail = single ? first.options.map(optionLine).join("\n") : questions.map((q) => q.question).join("\n");
  if (!isAnsweredHere(questions)) return { title, detail, buttons: [OPEN_BROWSER], acceptsText: false };
  const buttons = first.options.map(({ label: option }, index) => ({ answer: `option:${index}`, label: option }));
  return { title, detail, buttons, acceptsText: true };
}

/** A pop-up's few buttons fit one question with a single pick; the rest is answered in the browser. */
function isAnsweredHere(questions: WorkerQuestion[]): boolean {
  return questions.length === 1 && !questions[0].multiSelect;
}

function optionLine({ label, description }: WorkerQuestion["options"][number]): string {
  return description ? `${label}: ${description}` : label;
}

/** The option a button stands for, or the words typed; nothing for anything else the helper prints. */
function answerFrom(question: WorkerQuestion, answer: string): string | undefined {
  const option = OPTION_ANSWER.exec(answer);
  if (option) return question.options.at(Number(option[1]))?.label;
  return TEXT_ANSWER.exec(answer)?.[1].trim();
}
