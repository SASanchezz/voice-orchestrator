import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "./open-registry.js";
import { TaskHistory } from "./task-history.js";

setStateDir(mkdtempSync(join(tmpdir(), "vo-history-")));

function history(): TaskHistory {
  const { projects, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  return new TaskHistory(projects, sessions);
}

test("task history survives a restart", () => {
  const { registry, projects, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  new TaskHistory(projects, sessions).record(registry.activeSession("webshop").id, {
    task: "add rate limiting",
    outcome: "done",
    result: "Added a sliding window.",
  });
  assert.match(history().historyOf("webshop"), /\[done\] add rate limiting\nResult: Added a sliding window\./);
});
