import { test } from "node:test";
import assert from "node:assert/strict";
import type { QueuedTask } from "../../workers/queued-task.js";
import { FreshSessionTasks } from "./fresh-session-tasks.js";

const PROJECT = "shop";
const UNKNOWN_PROJECT = "nowhere";
const QUESTION: QueuedTask = { instruction: "Why is this loop here?" };

/** Numbers each session it opens, the way the registry does. */
class FakeSessions {
  opened: string[] = [];

  createSession(project: string): { id: string } {
    this.opened.push(project);
    return { id: `${project}-${this.opened.length}` };
  }
}

/** Knows one project only. */
const lookup = {
  requireProject(name: string): void {
    if (name !== PROJECT) throw new Error(`No project ${name}`);
  },
};

/** Writes down which session got which instruction. */
class FakeTasks {
  sent: string[] = [];

  runTask(sessionId: string, task: QueuedTask): string {
    this.sent.push(`${sessionId}: ${task.instruction}`);
    return "Sent.";
  }
}

function freshSessionTasks(): { fresh: FreshSessionTasks; sessions: FakeSessions; tasks: FakeTasks } {
  const sessions = new FakeSessions();
  const tasks = new FakeTasks();
  return { fresh: new FreshSessionTasks(sessions, lookup, tasks), sessions, tasks };
}

test("each task goes to a session opened for it", () => {
  const { fresh, tasks } = freshSessionTasks();
  fresh.runInNewSession(PROJECT, QUESTION);
  fresh.runInNewSession(PROJECT, QUESTION);
  assert.deepEqual(tasks.sent, [`shop-1: ${QUESTION.instruction}`, `shop-2: ${QUESTION.instruction}`]);
});

test("an unknown project opens no session", () => {
  const { fresh, sessions } = freshSessionTasks();
  assert.throws(() => fresh.runInNewSession(UNKNOWN_PROJECT, QUESTION));
  assert.deepEqual(sessions.opened, []);
});
