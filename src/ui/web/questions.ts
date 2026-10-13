// A worker's questions with proposed answers, as a small dialog card: pick an option or type your own answer.

import type { PendingQuestionView } from "../protocol.js";
import { act } from "./api.js";
import { button, byId, el, timeAgo } from "./dom.js";
import { answersIn, questionFields } from "./question-fields.js";
import { store } from "./store.js";

/** Cards are kept while their questions wait, so a pick or a half-typed answer survives the page's re-renders. */
const cards = new Map<string, HTMLFormElement>();
let shownIds = "";

export function renderQuestions(): void {
  const { questions } = store.state;
  const ids = questions.map(({ id }) => id).join(" ");
  if (ids === shownIds) return; // replacing the cards would take the keyboard away from an answer being typed
  shownIds = ids;
  for (const id of cards.keys()) if (!questions.some((asked) => asked.id === id)) cards.delete(id);
  byId("question-list", HTMLElement).replaceChildren(...questions.map(cardFor));
}

function cardFor(asked: PendingQuestionView): HTMLFormElement {
  const card = cards.get(asked.id) ?? questionCard(asked);
  cards.set(asked.id, card);
  return card;
}

function questionCard(asked: PendingQuestionView): HTMLFormElement {
  const problem = el("p", { class: "question-problem", role: "alert" });
  const card = el(
    "form",
    { class: "approval question-card" },
    cardHead(asked),
    ...asked.questions.map(questionFields),
    problem,
    el("div", { class: "approval-actions" }, ...actionsFor(asked)),
  );
  card.addEventListener("submit", (e) => {
    e.preventDefault();
    send(card, asked, problem);
  });
  if (isOneClick(asked)) card.addEventListener("change", (e) => sendOnPick(card, e));
  return card;
}

function cardHead(asked: PendingQuestionView): HTMLDivElement {
  const count = asked.questions.length;
  return el(
    "div",
    { class: "approval-head" },
    el("strong", {}, asked.label),
    el("span", { class: "muted" }, count === 1 ? "asks you" : `asks you ${count} questions`),
    el("span", { class: "muted" }, `· ${timeAgo(asked.createdAt)}`),
  );
}

function actionsFor(asked: PendingQuestionView): HTMLButtonElement[] {
  const sendButton = el("button", { type: "submit", class: "primary" }, "Send");
  return [sendButton, button("Skip", "", () => void act(`/api/questions/${asked.id}/skip`))];
}

/** One question with a single pick goes as soon as you click an option, like Claude Code's own dialog. */
function isOneClick(asked: PendingQuestionView): boolean {
  return asked.questions.length === 1 && !asked.questions[0].multiSelect;
}

function sendOnPick(card: HTMLFormElement, e: Event): void {
  if (e.target instanceof HTMLInputElement && e.target.type === "radio") card.requestSubmit();
}

function send(card: HTMLFormElement, asked: PendingQuestionView, problem: HTMLElement): void {
  const answers = answersIn(card, asked.questions);
  const unanswered = asked.questions.find(({ question }) => !answers[question]);
  problem.textContent = unanswered ? `Answer "${unanswered.question}" first.` : "";
  if (!unanswered) void act(`/api/questions/${asked.id}/answer`, { answers });
}
