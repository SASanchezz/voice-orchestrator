import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "./open-registry.js";
import type { ProjectStatus } from "./registry-schema.js";
import { StatusReport } from "./status-report.js";

/** webshop's only session, in this status with a task, as the model's status line shows it. */
function describedWith(status: ProjectStatus): string {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-status-")));
  const { projects, sessions, registry } = openRegistry({ webshop: "personal" }, new AppEvents());
  sessions.updateSession(registry.activeSession("webshop").id, { status, task: "Implement: the footer" });
  return new StatusReport(projects, sessions).sessionList("webshop");
}

test("a finished session's task is shown as its last task", () => {
  assert.match(describedWith("done"), /last task="Implement: the footer"/);
});

test("a running session's task is shown as its task", () => {
  assert.match(describedWith("running"), /, task="Implement: the footer"/);
});
