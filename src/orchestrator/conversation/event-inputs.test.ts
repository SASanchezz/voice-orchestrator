import { test } from "node:test";
import assert from "node:assert/strict";
import type { ContextFullEvent, QuestionEvent, TaskEndEvent } from "../../events/app-events.js";
import { inputFor } from "./event-inputs.js";
import { EventVoices } from "./event-voices.js";

const QUESTION = {
  question: "Which database?",
  header: "",
  multiSelect: false,
  options: [{ label: "Postgres", description: "" }],
};
const voices = new EventVoices({ stopSpeaking: () => {} });
const ASKED: QuestionEvent = {
  kind: "question",
  id: "q1",
  project: "webshop",
  session: "s1",
  label: "webshop session 2",
  questions: [QUESTION],
};

test("event inputs: a worker's question is only announced, not read aloud", () => {
  const input = inputFor(ASKED, voices);
  assert.equal(input.kind === "notice" ? input.spoken : "", "webshop session 2 has a question");
});

test("event inputs: several questions are announced as some questions", () => {
  const input = inputFor({ ...ASKED, questions: [QUESTION, QUESTION] }, voices);
  assert.equal(input.kind === "notice" ? input.spoken : "", "webshop session 2 has some questions");
});

test("event inputs: the model reads the question and that the user answers it on screen", () => {
  const input = inputFor(ASKED, voices);
  assert.match(input.kind === "notice" ? input.text : "", /webshop session 2 asks: "Which database\?".*web UI/);
});

test("event inputs: a worker's question has a voice its pop-up can silence", () => {
  const input = inputFor(ASKED, voices);
  voices.silence(ASKED);
  assert.equal(input.kind === "notice" && input.voice?.isSilenced(), true);
});

const FULL: ContextFullEvent = {
  kind: "context_full",
  project: "webshop",
  session: "s1",
  label: "webshop session 2",
  sessionNumber: 2,
  percent: 82,
};

test("event inputs: a full context is said once, suggesting a handoff", () => {
  const input = inputFor(FULL, voices);
  assert.equal(
    input.kind === "notice" ? input.spoken : "",
    "webshop session 2 is at 82 percent of its context; consider handing it off to a new session",
  );
});

const DONE: TaskEndEvent = {
  kind: "task_done",
  project: "webshop",
  session: "s1",
  label: "webshop session 2",
  sessionNumber: 2,
  task: "Please add a resend countdown.",
  result: `${"x".repeat(1000)}All tests pass.`,
};

test("event inputs: a finished task is a notice, said without a model turn", () => {
  assert.equal(inputFor(DONE, voices).kind, "notice");
});

test("event inputs: a finished task is said as its headline", () => {
  const input = inputFor(DONE, voices);
  assert.equal(input.kind === "notice" ? input.spoken : "", "webshop session 2 done: add a resend countdown");
});

test("event inputs: the model reads only the end of a finished task's closing note", () => {
  const input = inputFor(DONE, voices);
  const note = input.kind === "notice" ? input.text.split("closing note: ")[1].split("\n")[0] : "";
  assert.equal(note.length, 400);
});
