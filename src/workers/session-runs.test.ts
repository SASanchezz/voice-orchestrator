import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import type { Sessions } from "../registry/sessions.js";
import { testConfig } from "../testing/test-config.js";
import type { QueuedTask } from "./queued-task.js";
import { SessionQueue } from "./session-queue.js";
import { SessionRuns } from "./session-runs.js";
import { WorkerDirectory } from "./worker-directory.js";

interface Runs {
  runs: SessionRuns;
  sessions: Sessions;
  sessionId: string;
  ran: string[];
}

function sessionRuns(endsAs: "done" | "failed" = "done"): Runs {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-session-runs-")));
  const cfg = testConfig({ projects: { webshop: { path: "/code/webshop", profile: "personal" } } });
  const { registry, projects, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const sessionId = registry.activeSession("webshop").id;
  const ran: string[] = [];
  const starter = {
    run: (_session: string, task: QueuedTask) => {
      ran.push(task.instruction);
      sessions.updateSession(sessionId, { status: endsAs });
      return Promise.resolve();
    },
  };
  const runs = new SessionRuns(new SessionQueue(sessions), new WorkerDirectory(cfg, projects, sessions), starter);
  return { runs, sessions, sessionId, ran };
}

/** Work that goes on until the test finishes it. */
class HeldWork {
  private end: (value: string) => void = () => {};
  readonly promise = new Promise<string>((resolve) => {
    this.end = resolve;
  });

  finish(): void {
    this.end("done");
  }
}

const settled = () => new Promise((resolve) => setImmediate(resolve));

/** Two tasks queued behind work that runs alone, which the test then finishes as `status`. */
async function queuedBehind(runs: Runs, status: "done" | "failed" | "stopped"): Promise<void> {
  const held = new HeldWork();
  const outcome = runs.runs.runAlone(runs.sessionId, () => held.promise);
  runs.runs.submit(runs.sessionId, { instruction: "add tests" });
  runs.runs.submit(runs.sessionId, { instruction: "fix the footer" });
  runs.sessions.updateSession(runs.sessionId, { status });
  held.finish();
  await outcome;
  await settled();
}

test("session runs: work run alone counts as running", () => {
  const { runs, sessionId } = sessionRuns();
  void runs.runAlone(sessionId, () => new HeldWork().promise);
  assert.equal(runs.isRunning(sessionId), true);
});

test("session runs: tasks sent during work run alone run after it, once the work leaves the session done", async () => {
  const runs = sessionRuns();
  await queuedBehind(runs, "done");
  assert.deepEqual(runs.ran, ["add tests", "fix the footer"]);
});

test("session runs: after a step that failed the queue runs nothing", async () => {
  const runs = sessionRuns();
  await queuedBehind(runs, "failed");
  assert.deepEqual(runs.ran, []);
});

test("session runs: after a step that failed the queue keeps its tasks, paused", async () => {
  const runs = sessionRuns();
  await queuedBehind(runs, "failed");
  const { queued, queuePaused } = runs.sessions.session(runs.sessionId);
  assert.deepEqual([queued.length, queuePaused], [2, true]);
});

test("session runs: a queued task that fails pauses the tasks behind it", async () => {
  const runs = sessionRuns("failed");
  await queuedBehind(runs, "done");
  assert.deepEqual(runs.ran, ["add tests"]);
});

test("session runs: stopping keeps the queue, paused", async () => {
  const { runs, sessions, sessionId } = sessionRuns();
  void runs.runAlone(sessionId, () => new HeldWork().promise);
  runs.submit(sessionId, { instruction: "add tests" });
  runs.stop(sessionId);
  assert.equal(sessions.session(sessionId).queuePaused, true);
});

test("session runs: a task sent to an idle session with a paused queue starts at once", async () => {
  const runs = sessionRuns();
  await queuedBehind(runs, "failed");
  runs.runs.submit(runs.sessionId, { instruction: "fix the build" });
  await settled();
  assert.deepEqual(runs.ran, ["fix the build"]);
});

test("session runs: resuming an idle session runs its paused queue from #1", async () => {
  const runs = sessionRuns();
  await queuedBehind(runs, "failed");
  await runs.runs.resume(runs.sessionId);
  await settled();
  assert.deepEqual(runs.ran, ["add tests", "fix the footer"]);
});

test("session runs: resuming right after a stop runs the queue once the stopped work has ended", async () => {
  const { runs, sessionId, ran } = sessionRuns();
  const held = new HeldWork();
  void runs.runAlone(sessionId, () => held.promise);
  runs.submit(sessionId, { instruction: "add tests" });
  runs.stop(sessionId);
  const resumed = runs.resume(sessionId);
  held.finish();
  await resumed;
  await settled();
  assert.deepEqual(ran, ["add tests"]);
});

test("session runs: work is not run alone beside a running task", () => {
  const { runs, sessionId } = sessionRuns();
  runs.submit(sessionId, { instruction: "add tests" });
  assert.throws(() => runs.runAlone(sessionId, () => new HeldWork().promise), /is working/);
});
