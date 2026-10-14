import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { TaskHistory } from "../registry/task-history.js";
import type { Sessions } from "../registry/sessions.js";
import { CostAlerts } from "../budget/cost-alerts.js";
import { DailySpend } from "../budget/daily-spend.js";
import { SpendLedger } from "../budget/spend-ledger.js";
import { DEFAULT_BUDGET } from "../config/budget-config.js";
import type { RunningTask } from "./running-task.js";
import { TaskRecorder } from "./task-recorder.js";
import { WorkerChat } from "./worker-chat.js";

/** A fresh state folder each time, so no test sees another's costs. */
function recorded(): { recorder: TaskRecorder; sessions: Sessions; task: RunningTask } {
  const dir = mkdtempSync(join(tmpdir(), "vo-recorder-"));
  setStateDir(dir);
  const { registry, projects, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const sessionId = registry.activeSession("webshop").id;
  const task = { sessionId, project: "webshop", sessionNumber: 1, instruction: "fix it", account: "personal" };
  const ledger = new SpendLedger(
    sessions,
    new DailySpend(join(dir, "spend.json")),
    new CostAlerts(new WorkerChat(), DEFAULT_BUDGET),
  );
  return { recorder: new TaskRecorder(sessions, new TaskHistory(projects, sessions), ledger), sessions, task };
}

test("task recorder: a resumed conversation's running total is not counted twice", () => {
  const { recorder, sessions, task } = recorded();
  recorder.succeeded(task, "first", 1);
  recorder.succeeded(task, "second", 1.5);
  assert.equal(sessions.session(task.sessionId).costUsd, 1.5);
});

test("task recorder: a failed task's spend counts toward the same running total", () => {
  const { recorder, sessions, task } = recorded();
  recorder.addCost(task, 2);
  recorder.succeeded(task, "next", 2.5);
  assert.equal(sessions.session(task.sessionId).costUsd, 2.5);
});
