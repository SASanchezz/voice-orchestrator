import { test } from "node:test";
import assert from "node:assert/strict";
import { AppEvents, type AppEvent, type QuestionEvent } from "../events/app-events.js";
import type { AnswersByQuestion } from "../questions/question-types.js";
import { TestQuestionPanels } from "../testing/test-question-panels.js";
import type { PageTarget } from "./page-target.js";
import { QuestionPopups } from "./question-popups.js";

const DATABASE = "Which database?";
const POSTGRES = { label: "Postgres", description: "Robust" };
const SQLITE = { label: "SQLite", description: "" };
const ONE_QUESTION: QuestionEvent = {
  kind: "question",
  id: "q1",
  project: "webshop",
  session: "s1",
  label: "webshop",
  questions: [{ question: DATABASE, header: "Database", multiSelect: false, options: [POSTGRES, SQLITE] }],
};
const TWO_QUESTIONS: QuestionEvent = {
  ...ONE_QUESTION,
  questions: [...ONE_QUESTION.questions, { ...ONE_QUESTION.questions[0], question: "Which port?" }],
};

/** Question pop-ups following their events; records what they answered and which pages they opened. */
function popups() {
  const events = new AppEvents();
  const panels = new TestQuestionPanels();
  const answered: AnswersByQuestion[] = [];
  const opened: PageTarget[] = [];
  const silenced: AppEvent[] = [];
  const clicks = { answerByClick: (_id: string, answers: AnswersByQuestion) => String(answered.push(answers)) };
  const actions = {
    openPage: async (target: PageTarget) => void opened.push(target),
    silence: (event: AppEvent) => void silenced.push(event),
  };
  new QuestionPopups(panels, clicks, actions).follow(events);
  return { events, panels, answered, opened, silenced };
}

test("question popups: one question shows its options as buttons, with descriptions, and a field for your words", () => {
  const { events, panels } = popups();
  events.emitEvent(ONE_QUESTION);
  assert.deepEqual(panels.latest().panel, {
    title: `webshop asks: ${DATABASE}`,
    detail: "Postgres: Robust\nSQLite",
    buttons: [
      { answer: "option:0", label: "Postgres" },
      { answer: "option:1", label: "SQLite" },
    ],
    acceptsText: true,
  });
});

test("question popups: an option's button answers with its label", () => {
  const { events, panels, answered } = popups();
  events.emitEvent(ONE_QUESTION);
  panels.latest().choose("option:1");
  assert.deepEqual(answered, [{ [DATABASE]: "SQLite" }]);
});

test("question popups: typed words answer the question", () => {
  const { events, panels, answered } = popups();
  events.emitEvent(ONE_QUESTION);
  panels.latest().choose("text:MySQL, please");
  assert.deepEqual(answered, [{ [DATABASE]: "MySQL, please" }]);
});

test("question popups: anything else the helper prints answers nothing", () => {
  const { events, panels, answered } = popups();
  events.emitEvent(ONE_QUESTION);
  panels.latest().choose("option:7");
  assert.deepEqual(answered, []);
});

test("question popups: several questions only offer the browser", () => {
  const { events, panels } = popups();
  events.emitEvent(TWO_QUESTIONS);
  assert.deepEqual(panels.latest().panel.buttons, [{ answer: "open", label: "Open in browser" }]);
});

test("question popups: a question with several picks only offers the browser", () => {
  const { events, panels } = popups();
  const multiSelect = { ...ONE_QUESTION.questions[0], multiSelect: true };
  events.emitEvent({ ...ONE_QUESTION, questions: [multiSelect] });
  assert.equal(panels.latest().panel.acceptsText, false);
});

test("question popups: Open in browser opens the asking session", () => {
  const { events, panels, opened } = popups();
  events.emitEvent(TWO_QUESTIONS);
  panels.latest().choose("open");
  assert.deepEqual(opened, [{ view: "session", sessionId: "s1" }]);
});

test("question popups: answering elsewhere closes the pop-up", () => {
  const { events, panels } = popups();
  events.emitEvent(ONE_QUESTION);
  events.emitQuestionClosed("q1");
  assert.equal(panels.latest().closed, true);
});

for (const answer of ["option:0", "text:MySQL", "open"]) {
  test(`question popups: clicking ${answer} silences the spoken question`, () => {
    const { events, panels, silenced } = popups();
    events.emitEvent(ONE_QUESTION);
    panels.latest().choose(answer);
    assert.deepEqual(silenced, [ONE_QUESTION]);
  });
}
