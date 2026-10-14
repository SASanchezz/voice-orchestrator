/**
 * End-to-end flow test with Claude replaced by scripted fakes (see support/harness.ts).
 * One story in order: each flow builds on the state the previous ones left behind.
 */
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import "./flows/operator-setup.flow.js";
import "./flows/project-work.flow.js";
import "./flows/notifications.flow.js";
import "./flows/ui-access.flow.js";
import "./flows/replies.flow.js";
import "./flows/history-and-restarts.flow.js";
import "./flows/sessions.flow.js";
import "./flows/chats.flow.js";
import "./flows/clear-assistant.flow.js";
import "./flows/attachments.flow.js";
import "./flows/voice-attachments.flow.js";
import "./flows/usage-limits.flow.js";
import "./flows/permission-popups.flow.js";
import "./flows/read-only-commands.flow.js";
import "./flows/task-endings.flow.js";
import "./flows/worker-questions.flow.js";
import "./flows/project-removal.flow.js";
import { voice } from "./support/harness.js";
import { acmeWeb, commitCount, dbadmin } from "./support/sandbox.js";

test("cleanup: remove dummy files from both repos", () => {
  execSync("git reset -q && rm -rf tmp", { cwd: acmeWeb });
  execSync("git reset -q --hard HEAD~1 && rm -rf tmp", { cwd: dbadmin });
  assert.equal(execSync("git status --short", { cwd: acmeWeb, encoding: "utf8" }), "");
  assert.equal(execSync("git status --short", { cwd: dbadmin, encoding: "utf8" }), "");
  assert.equal(commitCount(dbadmin), 1);
});

after(() => {
  console.log("\n--- spoken during the run ---\n" + voice.spoken.map((s) => "🔊 " + s.replace(/\n/g, " ")).join("\n"));
  setTimeout(() => process.exit(0), 50);
});
