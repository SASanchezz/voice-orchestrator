import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BackgroundJobs } from "./background-jobs.js";

const SESSION = "s1";
const TASK_ID = "bk7ve1xz3";

interface LiveTask {
  task_id: string;
  description: string;
  ambient?: boolean;
}

/** Just the fields the tracker reads; the SDK's messages carry many more. */
const liveTasks = (...tasks: LiveTask[]): object => ({ type: "system", subtype: "background_tasks_changed", tasks });

const voiceTest = (): object => liveTasks({ task_id: TASK_ID, description: "Run the voice test" });

const startedInBackground = (outputFile: string): object => ({
  type: "user",
  message: {
    content: [
      {
        type: "tool_result",
        content: `Command running in background with ID: ${TASK_ID}. Output is being written to: ${outputFile}. You will be notified when it completes.`,
      },
    ],
  },
});

const progress = (summary: string): object => ({ type: "system", subtype: "task_progress", task_id: TASK_ID, summary });

const outputFileWith = (text: string): string => {
  const path = join(mkdtempSync(join(tmpdir(), "jobs-")), `${TASK_ID}.output`);
  writeFileSync(path, text);
  return path;
};

const jobsAfter = (...messages: object[]): BackgroundJobs => {
  const jobs = new BackgroundJobs();
  for (const msg of messages) jobs.follow(SESSION, msg);
  return jobs;
};

test("a live background task is listed with its description", () => {
  const [job] = jobsAfter(voiceTest()).jobsOf(SESSION);
  assert.equal(job?.description, "Run the voice test");
});

test("an ambient task is not listed", () => {
  const jobs = jobsAfter(liveTasks({ task_id: "w1", description: "Watch files", ambient: true }));
  assert.deepEqual(jobs.jobsOf(SESSION), []);
});

test("a task missing from the next live set has ended", () => {
  assert.deepEqual(jobsAfter(voiceTest(), liveTasks()).jobsOf(SESSION), []);
});

test("a new Claude Code process starts with no jobs", () => {
  const init = { type: "system", subtype: "init" };
  assert.deepEqual(jobsAfter(voiceTest(), init).jobsOf(SESSION), []);
});

test("a task keeps the time it was first seen", () => {
  const first = jobsAfter(voiceTest());
  const startedAt = first.jobsOf(SESSION)[0]?.startedAt;
  first.follow(SESSION, voiceTest());
  assert.equal(first.jobsOf(SESSION)[0]?.startedAt, startedAt);
});

test("a command's step is the last line its output file holds", () => {
  const outputFile = outputFileWith("Loading model\nSynthesizing clip 3 of 8\n");
  const [job] = jobsAfter(voiceTest(), startedInBackground(outputFile)).jobsOf(SESSION);
  assert.equal(job?.step, "Synthesizing clip 3 of 8");
});

test("a helper agent's step is its latest progress summary", () => {
  const [job] = jobsAfter(voiceTest(), progress("Reading the tests")).jobsOf(SESSION);
  assert.equal(job?.step, "Reading the tests");
});

test("another session's jobs are not listed", () => {
  assert.deepEqual(jobsAfter(voiceTest()).jobsOf("s2"), []);
});
