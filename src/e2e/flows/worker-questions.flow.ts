import { test } from "node:test";
import assert from "node:assert/strict";
import { app, questionPanels } from "../support/harness.js";
import { countSince, heardTimes, mark, pause, uiPost } from "../support/helpers.js";

const { questions, workers } = app;
const QUESTION = "Which database?";

async function nextQuestionsId(): Promise<string> {
  while (!questions.waiting.all().length) await pause(20);
  return questions.waiting.all()[0].id;
}

test("a worker's question is announced in one short line and answered in the web UI", async () => {
  const i = mark();
  workers.intake.run("dbadmin", `ask: ${QUESTION}|Postgres,SQLite`);
  const id = await nextQuestionsId();
  await heardTimes(/^dbadmin( session \d+)? has a question$/, 1, i);
  await uiPost(`/api/questions/${id}/answer`, { answers: { [QUESTION]: "SQLite" } });
  await heardTimes(/^dbadmin session \d+ done: /, 1, i);
  assert.equal(countSince(i, /^(?!dbadmin session \d+ done: ).*(Which database|Postgres)/), 0); // the task's own headline names it
});

test("the worker continues with the answer from the question's pop-up", async () => {
  const i = mark();
  workers.intake.run("dbadmin", `ask: ${QUESTION}|Postgres,SQLite`);
  await nextQuestionsId();
  questionPanels.latest().choose("option:0");
  await heardTimes(/^dbadmin session \d+ done: /, 1, i);
  const [last] = app.core.registry.activeSession("dbadmin").history.slice(-1);
  assert.match(last.result, /answered \{"Which database\?":"Postgres"\}/);
});
