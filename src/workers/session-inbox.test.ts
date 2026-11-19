import { test } from "node:test";
import assert from "node:assert/strict";
import { SessionInbox } from "./session-inbox.js";

interface Sent {
  inbox: SessionInbox;
  tasks: string[];
  asides: string[];
}

function recordingInbox(): Sent {
  const tasks: string[] = [];
  const asides: string[] = [];
  const intake = {
    runInSession: (_session: string, instruction: string) => (tasks.push(instruction), "started"),
    runOnModel: (_session: string, instruction: string, model: string) => (
      tasks.push(`${model}: ${instruction}`),
      "started"
    ),
  };
  const sideQuestions = {
    ask: (_session: string, _line: string, question: string) => (asides.push(question), "asked"),
  };
  return { inbox: new SessionInbox(intake, sideQuestions), tasks, asides };
}

test("session inbox: /btw asks the question aside", () => {
  const { inbox, asides } = recordingInbox();
  inbox.send("s1", { instruction: "/btw what does the timer do?" });
  assert.deepEqual(asides, ["what does the timer do?"]);
});

test("session inbox: /btw doesn't start or queue a task", () => {
  const { inbox, tasks } = recordingInbox();
  inbox.send("s1", { instruction: "/BTW is it done?" });
  assert.deepEqual(tasks, []);
});

test("session inbox: a bare /btw asks for a question", () => {
  const { inbox } = recordingInbox();
  assert.equal(inbox.send("s1", { instruction: "/btw " }), "Add a question after /btw.");
});

test("session inbox: a word starting with /btw is a task", () => {
  const { inbox, tasks } = recordingInbox();
  inbox.send("s1", { instruction: "/btwx run it" });
  assert.deepEqual(tasks, ["/btwx run it"]);
});

test("session inbox: a task with its own model runs on it", () => {
  const { inbox, tasks } = recordingInbox();
  inbox.send("s1", { instruction: "add tests", model: "opus" });
  assert.deepEqual(tasks, ["opus: add tests"]);
});
