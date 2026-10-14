import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setStateDir } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { testConfig } from "../testing/test-config.js";
import { WorkerDirectory } from "./worker-directory.js";

function sessionWithHandoff(claudeSessionId?: string) {
  setStateDir(mkdtempSync(join(tmpdir(), "vo-directory-")));
  const { registry, projects, sessions } = openRegistry({ webshop: "personal" }, new AppEvents());
  const { id } = registry.activeSession("webshop");
  sessions.updateSession(id, { handoff: "Done: the timer.", claudeSessionId });
  return { directory: new WorkerDirectory(testConfig({}), projects, sessions), id };
}

test("worker directory: a fresh session's first task carries its handoff", () => {
  const { directory, id } = sessionWithHandoff();
  assert.equal(directory.newTask(id, "add tests").handoff, "Done: the timer.");
});

test("worker directory: once the conversation exists, the handoff isn't sent again", () => {
  const { directory, id } = sessionWithHandoff("claude-1");
  assert.equal(directory.newTask(id, "add tests").handoff, undefined);
});
