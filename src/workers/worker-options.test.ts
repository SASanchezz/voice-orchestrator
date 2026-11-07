import { test } from "node:test";
import assert from "node:assert/strict";
import { copyFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HookJSONOutput, Options } from "@anthropic-ai/claude-agent-sdk";
import { DESTRUCTIVE_PATH, setStateDir, WORKER_PLUGIN_PATH } from "../config/paths.js";
import { AppEvents } from "../events/app-events.js";
import { openRegistry } from "../registry/open-registry.js";
import { DestructiveList } from "../safety/destructive-list.js";
import { testConfig } from "../testing/test-config.js";
import { addWorktree, makeGitRepo } from "../testing/test-git-repo.js";
import { workerRules } from "../testing/test-worker-rules.js";
import { WorkerDirectory } from "./worker-directory.js";
import { WorkerOptions } from "./worker-options.js";

const PROJECT = "webshop";

/** Worker options for one personal project, with the registry and the destructive rules in a temp folder. */
function workerOptions(): { options: WorkerOptions; directory: WorkerDirectory; sessionId: string } {
  const dir = mkdtempSync(join(tmpdir(), "vo-worker-options-"));
  setStateDir(dir);
  const rulesFile = join(dir, "destructive.yaml");
  copyFileSync(DESTRUCTIVE_PATH, rulesFile);
  const cfg = testConfig({ projects: { [PROJECT]: { path: dir, profile: "personal" } } });
  const { registry, projects, sessions } = openRegistry({ [PROJECT]: "personal" }, new AppEvents());
  const directory = new WorkerDirectory(cfg, projects, sessions);
  const options = new WorkerOptions(cfg, directory, workerRules(new DestructiveList(rulesFile)));
  return { options, directory, sessionId: registry.activeSession(PROJECT).id };
}

const denyAll = (): Promise<{ behavior: "deny"; message: string }> =>
  Promise.resolve({ behavior: "deny", message: "test" });

function taskOptions(): Options {
  const { options, directory, sessionId } = workerOptions();
  return options.forTask(directory.newTask(sessionId, "add tests"), new AbortController(), denyAll);
}

test("worker options: a task's session is tagged to show in Claude Code's session lists", () => {
  assert.equal(taskOptions().env?.CLAUDE_CODE_ENTRYPOINT, "cli");
});

test("worker options: a task keeps its account's environment", () => {
  assert.equal(taskOptions().env?.CLAUDE_CONFIG_DIR, "/c");
});

test("worker options: a task gets the worker skills", () => {
  assert.deepEqual(taskOptions().plugins, [{ type: "local", path: WORKER_PLUGIN_PATH }]);
});

test("worker options: the worker skills ship the review-and-commit skill", () => {
  assert.ok(existsSync(join(WORKER_PLUGIN_PATH, "skills/review-and-commit/SKILL.md")));
});

test("worker options: the handoff and summary forks keep the tag they would get anyway", () => {
  const { options } = workerOptions();
  assert.equal(options.forProject(PROJECT).env?.CLAUDE_CODE_ENTRYPOINT, process.env.CLAUDE_CODE_ENTRYPOINT);
});

/** What the task's PreToolUse hook answers for a Bash `command` run in `cwd`. */
async function hookAnswer(command: string, cwd: string): Promise<HookJSONOutput> {
  const options = taskOptions();
  const [hook] = (options.hooks?.PreToolUse ?? []).flatMap((matcher) => matcher.hooks);
  const base = { session_id: "s", transcript_path: "", cwd, tool_use_id: `hook-${command}-${cwd}` };
  const input = { ...base, hook_event_name: "PreToolUse" as const, tool_name: "Bash", tool_input: { command } };
  return hook(input, base.tool_use_id, { signal: new AbortController().signal });
}

test("worker options: a commit in a worktree on its own branch isn't forced to ask", async () => {
  const worktree = addWorktree(makeGitRepo(), "worktree-agent-a1");
  assert.deepEqual(await hookAnswer("git commit -m x", worktree), {});
});

test("worker options: a commit in the main checkout is forced to ask", async () => {
  assert.notDeepEqual(await hookAnswer("git commit -m x", makeGitRepo()), {});
});
