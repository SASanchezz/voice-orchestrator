// One question's fields in a question card: its options as radio buttons or checkboxes, and a field for your own words.

import type { QuestionOptionView, QuestionView } from "../protocol.js";
import { el } from "./dom.js";

const OTHER_SUFFIX = "-other";

export function questionFields(question: QuestionView, index: number): HTMLFieldSetElement {
  const name = fieldName(index);
  const kind = question.multiSelect ? "checkbox" : "radio";
  const other = el("input", { type: "text", name: name + OTHER_SUFFIX, class: "question-other" });
  other.placeholder = question.multiSelect ? "Add your own answer" : "Or type your own answer";
  return el(
    "fieldset",
    { class: "question" },
    el("legend", {}, ...headerChip(question), question.question),
    ...question.options.map((option) => optionChoice(option, name, kind)),
    other,
  );
}

/** Your answer to each question by its text: your own words replace a single pick and join several picks. */
export function answersIn(card: HTMLFormElement, questions: QuestionView[]): Record<string, string> {
  const form = new FormData(card);
  return Object.fromEntries(
    questions.map(({ question, multiSelect }, index) => [question, answerOf(form, fieldName(index), multiSelect)]),
  );
}

function answerOf(form: FormData, name: string, multiSelect: boolean): string {
  const picks = form.getAll(name).filter((value) => typeof value === "string");
  const typed = form.get(name + OTHER_SUFFIX);
  const own = typeof typed === "string" ? typed.trim() : "";
  if (multiSelect) return [...picks, own].filter(Boolean).join(", ");
  return own || (picks[0] ?? "");
}

function fieldName(index: number): string {
  return `question-${index}`;
}

function headerChip(question: QuestionView): HTMLSpanElement[] {
  return question.header ? [el("span", { class: "question-chip" }, question.header)] : [];
}

function optionChoice(option: QuestionOptionView, name: string, kind: string): HTMLLabelElement {
  return el(
    "label",
    { class: "question-option" },
    el("input", { type: kind, name, value: option.label }),
    el("span", { class: "option-label" }, option.label),
    option.description ? el("span", { class: "option-description muted" }, option.description) : "",
  );
}
