import { test } from "node:test";
import assert from "node:assert/strict";
import { HeadlineWriter } from "./headline-writer.js";

interface Question {
  project: string;
  prompt: string;
  purpose: string;
}

function writerReplying(reply: string): { questions: Question[]; writer: HeadlineWriter } {
  const questions: Question[] = [];
  const ask = (project: string, prompt: string, purpose: string): Promise<string> => {
    questions.push({ project, prompt, purpose });
    return Promise.resolve(reply);
  };
  return { questions, writer: new HeadlineWriter({ ask }) };
}

test("headline writer: keeps only the first line of the reply, without quotes or full stop", async () => {
  const { writer } = writerReplying('"Worker pop-ups: notices name the topic."\nMore words');
  assert.equal(
    await writer.write("shop", "I wish to change the pop-ups", "Done."),
    "Worker pop-ups: notices name the topic",
  );
});

test("headline writer: shows the model the end of the closing note", async () => {
  const { questions, writer } = writerReplying("Headline");
  await writer.write("shop", "task", `${"x".repeat(5000)} Added a resend countdown.`);
  assert.match(questions[0].prompt, /Added a resend countdown\.\n/);
});

test("headline writer: asks on the task's project", async () => {
  const { questions, writer } = writerReplying("Headline");
  await writer.write("shop", "task", "note");
  assert.equal(questions[0].project, "shop");
});

test("headline writer: throws when the reply is empty", async () => {
  const { writer } = writerReplying("  ");
  await assert.rejects(writer.write("shop", "task", "note"), /empty/);
});
