import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import type { Sessions } from "../registry/sessions.js";
import type { RunningTask } from "./running-task.js";
import { UNNAMED_TOPICS, WrittenTopics } from "./task-topics.js";

let sessions: Sessions;
let task: RunningTask;

const writing = { write: (): Promise<string> => Promise.resolve("Sign-up: resend countdown added") };
const failing = { write: (): Promise<string> => Promise.reject(new Error("headline failed: error_max_turns")) };

beforeEach(() => {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-task-topics-")));
  sessions = openRegistry({ shop: "work" }, new AppEvents()).sessions;
  const sessionId = sessions.sessionsOf("shop")[0].id;
  task = { sessionId, project: "shop", sessionNumber: 1, instruction: "I wish to add a countdown", account: "work" };
});

test("task topics: a finished task is named by its written headline", async () => {
  assert.equal(await new WrittenTopics(writing, sessions).topicOf(task, "Done."), "Sign-up: resend countdown added");
});

test("task topics: without a headline, the session's title names it", async () => {
  sessions.updateSession(task.sessionId, { title: "Resend countdown" });
  assert.equal(await new WrittenTopics(failing, sessions).topicOf(task, "Done."), "Resend countdown");
});

test("task topics: without a headline or a title, nothing names it", async () => {
  assert.equal(await new WrittenTopics(failing, sessions).topicOf(task, "Done."), undefined);
});

test("task topics: unnamed topics name nothing", async () => {
  assert.equal(await UNNAMED_TOPICS.topicOf(task, "Done."), undefined);
});
