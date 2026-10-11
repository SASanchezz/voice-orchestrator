import { test } from "node:test";
import assert from "node:assert/strict";
import type { AppEvent } from "../../events/app-events.js";
import { app, voice } from "../support/harness.js";
import { countSince, feedHas, mark, pause, untilIdle } from "../support/helpers.js";

const { core, ui, workers } = app;
const { todo } = workers;

const LIMIT_ERROR =
  "You've hit your org's monthly spend limit · run /usage-credits to ask your admin for a higher limit · your session limit resets 9pm (Europe/Warsaw)";
const LIMIT_NOTICE =
  /^dbadmin hit the personal account limit; resets 9pm \(Europe\/Warsaw\); \d+ tasks? saved to todo$/;

/** Runs a dbadmin task that fails on the account limit; resolves once it has ended. */
async function hitLimit(task: string): Promise<void> {
  await untilIdle("dbadmin");
  workers.intake.run("dbadmin", `${task}\nerror: ${LIMIT_ERROR}`);
  await pause(50);
  await untilIdle("dbadmin");
}

function emptyTodo(): void {
  for (const saved of todo.list()) todo.remove(saved.id);
}

test("limit: a task that hits the account limit is saved to todo with its details", async () => {
  await hitLimit("Add sorting to the users list");
  const [saved] = todo.list();
  assert.deepEqual(
    [saved.project, saved.sessionNumber, saved.account, saved.resetsAt, saved.task],
    [
      "dbadmin",
      core.registry.activeSession("dbadmin").number,
      "personal",
      "9pm (Europe/Warsaw)",
      `Add sorting to the users list\nerror: ${LIMIT_ERROR}`,
    ],
  );
});

test("limit: the user is told once, with the reset time and how many tasks were saved", async () => {
  assert.match(await voice.heard(LIMIT_NOTICE, 0), /1 task saved to todo$/);
});

test("limit: the failure is not also reported as a failed task", async () => {
  await feedHas(/account limit/);
  assert.equal(ui.feed.recent().filter((e) => /spend limit/.test(e.detail ?? "")).length, 0);
});

test("limit: the duplicate error Claude Code throws is ignored", () => {
  assert.equal(ui.feed.recent().filter((e) => /account limit/.test(e.text)).length, 1);
});

test("limit: a second limit failure on the same account is saved quietly", async () => {
  const i = mark();
  await hitLimit("Add filters to the events list");
  await pause(300);
  assert.deepEqual([todo.list().length, countSince(i, LIMIT_NOTICE)], [2, 0]);
});

test("limit: tasks queued behind a limit failure are saved to todo, not run", async () => {
  emptyTodo();
  await untilIdle("dbadmin");
  workers.intake.run("dbadmin", `sleep: 100\nerror: ${LIMIT_ERROR}`);
  workers.intake.run("dbadmin", "Queued after the limit");
  await pause(50);
  await untilIdle("dbadmin");
  assert.deepEqual(
    todo.list().map((t) => t.task.split("\n")[0]),
    ["sleep: 100", "Queued after the limit"],
  );
});

test("limit: the assistant can list the todo tasks", async () => {
  const i = mark();
  voice.say("list todo");
  await voice.heard(
    /: dbadmin session \d+, personal account, saved .*, limit resets 9pm \(Europe\/Warsaw\)\n {2}Queued after the limit/,
    i,
  );
});

test("limit: running all todo tasks starts them and empties the list", async () => {
  emptyTodo();
  todo.save({
    project: "dbadmin",
    sessionNumber: 1,
    account: "personal",
    savedAt: new Date().toISOString(),
    task: "sleep: 5",
  });
  const i = mark();
  voice.say("run todo all");
  await voice.heard(/^Started on dbadmin/, i);
  assert.equal(todo.list().length, 0);
});

test("limit: after a retry, hitting the limit again is announced again", async () => {
  emptyTodo();
  await untilIdle("dbadmin");
  const task = `retry\nerror: ${LIMIT_ERROR}`;
  todo.save({ project: "dbadmin", sessionNumber: 1, account: "personal", savedAt: new Date().toISOString(), task });
  const i = mark();
  voice.say("run todo all");
  await voice.heard(LIMIT_NOTICE, i);
  emptyTodo();
});

test("an ordinary failure is reported once, not again for Claude Code's repeated error", async () => {
  await untilIdle("dbadmin");
  const failures: AppEvent[] = [];
  const listen = (e: AppEvent): void => {
    if (e.kind === "task_failed") failures.push(e);
  };
  core.events.on("event", listen);
  workers.intake.run("dbadmin", "error: the build broke");
  await pause(50);
  await untilIdle("dbadmin");
  core.events.off("event", listen);
  assert.equal(failures.length, 1);
});
