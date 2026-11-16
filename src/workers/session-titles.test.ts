import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import type { Sessions } from "../registry/sessions.js";
import { SessionTitles } from "./session-titles.js";
import { WorkerChat } from "./worker-chat.js";

const TASK_RECORD = { task: "Earlier", outcome: "done", result: "", finishedAt: "2026-11-13T10:00:00.000Z" } as const;

let sessions: Sessions;
let sessionId: string;
let asked: string[];

const writer = {
  write: async (_project: string, task: string): Promise<string> => {
    asked.push(task);
    return `Title of ${task}`;
  },
};

beforeEach(() => {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-session-titles-")));
  sessions = openRegistry({ shop: "work" }, new AppEvents()).sessions;
  sessionId = sessions.sessionsOf("shop")[0].id;
  asked = [];
});

test("titles: titles a new session after its first task", async () => {
  await new SessionTitles(writer, sessions).nameIfNew(sessionId, "Fix the tabs");
  assert.equal(sessions.session(sessionId).title, "Title of Fix the tabs");
});

test("titles: keeps a title once written", async () => {
  sessions.updateSession(sessionId, { title: "Kept" });
  await new SessionTitles(writer, sessions).nameIfNew(sessionId, "Another task");
  assert.equal(sessions.session(sessionId).title, "Kept");
});

test("titles: leaves a session that already has history to its first task", async () => {
  sessions.updateSession(sessionId, { history: [TASK_RECORD] });
  await new SessionTitles(writer, sessions).nameIfNew(sessionId, "Later task");
  assert.deepEqual(asked, []);
});

test("titles: asks once while a title is being written", async () => {
  const titles = new SessionTitles(writer, sessions);
  await Promise.all([titles.nameIfNew(sessionId, "First"), titles.nameIfNew(sessionId, "Second")]);
  assert.deepEqual(asked, ["First"]);
});

test("titles: leaves the session untitled when writing fails", async () => {
  const failing = { write: (): Promise<string> => Promise.reject(new Error("model down")) };
  await new SessionTitles(failing, sessions).nameIfNew(sessionId, "Fix the tabs");
  assert.equal(sessions.session(sessionId).title, undefined);
});

test("titles: titles from task lines in the chat", async () => {
  const chat = new WorkerChat();
  new SessionTitles(writer, sessions).follow(chat);
  chat.say(sessionId, "task", "Fix the tabs");
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(asked, ["Fix the tabs"]);
});
