import { test } from "node:test";
import assert from "node:assert/strict";
import { QuietSessions } from "../events/quiet-sessions.js";
import type { SavedTodo } from "../limits/todo-file.js";
import { emptySession } from "../registry/session-records.js";
import { QuietResume, type ResumeSessions } from "./quiet-resume.js";

const SAVED: SavedTodo = {
  id: "20261108-192916-casini-gdk-s15",
  project: "casini-gdk",
  sessionNumber: 15,
  account: "work",
  savedAt: "2026-11-08T19:29:16.448Z",
  task: "Drop the Util names.",
};

interface Resumed {
  sessionId: string;
  instruction: string;
}

const resumeWith = (openNumbers: number[]) => {
  const resumed: Resumed[] = [];
  const todos = {
    resume: (_saved: SavedTodo, sessionId: string, instruction: string) => {
      resumed.push({ sessionId, instruction });
      return "Started.";
    },
  };
  const sessions = fakeSessions(openNumbers);
  const quiet = new QuietSessions();
  new QuietResume(todos, sessions, quiet).resume(SAVED);
  return { resumed: resumed[0], quiet };
};

function fakeSessions(openNumbers: number[]): ResumeSessions {
  return {
    hasSessionNumbered: (_project, number) => openNumbers.includes(number),
    sessionByNumber: (project, number) => emptySession(`s${number}`, project, number),
    activeSession: (project) => emptySession("active", project, 1),
  };
}

test("quiet resume: the task goes back to the session it was cut off in", () => {
  assert.equal(resumeWith([15]).resumed.sessionId, "s15");
});

test("quiet resume: if that session was closed, the project's active one takes it", () => {
  assert.equal(resumeWith([1]).resumed.sessionId, "active");
});

test("quiet resume: the worker is told to continue rather than start over", () => {
  assert.match(resumeWith([15]).resumed.instruction, /continue from there\.\n\nDrop the Util names\.$/);
});

test("quiet resume: the session is kept quiet", () => {
  assert.equal(resumeWith([15]).quiet.isQuiet("s15"), true);
});
