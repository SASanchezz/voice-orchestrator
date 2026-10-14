import type { CanUseTool, HookCallback, Options } from "@anthropic-ai/claude-agent-sdk";
import { envForProfile } from "../config/accounts.js";
import type { AppConfig } from "../config/app-config.js";
import type { DestructiveList } from "../safety/destructive-list.js";
import { readsSecrets } from "../safety/call-safety.js";
import { toolInput } from "../safety/tool-calls.js";
import type { RunningTask } from "./running-task.js";
import type { WorkerDirectory } from "./worker-directory.js";

/** SDK options for a project's Claude Code process: its folder, its account, and your Claude Code settings. */
export class WorkerOptions {
  constructor(
    private cfg: AppConfig,
    private directory: WorkerDirectory,
    private destructive: DestructiveList,
  ) {}

  forProject(project: string): Options {
    return {
      cwd: this.directory.folderOf(project),
      env: envForProfile(this.cfg, this.directory.accountOf(project)),
      pathToClaudeCodeExecutable: this.cfg.claudeBin,
      model: this.directory.modelOf(project),
      settingSources: ["user", "project", "local"], // CLAUDE.md + the same allowlists your VS Code sessions use
      systemPrompt: { type: "preset", preset: "claude_code" },
    };
  }

  /** A task resumes its session's conversation, and asks you (permissions and questions) through canUseTool. */
  forTask(task: RunningTask, abortController: AbortController, canUseTool: CanUseTool): Options {
    return {
      ...this.forProject(task.project),
      resume: task.resume,
      abortController,
      permissionMode: "default",
      canUseTool,
      hooks: { PreToolUse: [{ hooks: [this.forceAsk] }] },
    };
  }

  /** Destructive commands and reading secrets always go to a voice prompt, even if an allow rule would pass them. */
  private forceAsk: HookCallback = async (input) => {
    if (input.hook_event_name !== "PreToolUse") return {};
    const reason = this.askReason(input.tool_name, toolInput(input.tool_input));
    if (!reason) return {};
    return {
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "ask", permissionDecisionReason: reason },
    };
  };

  private askReason(toolName: string, input: Record<string, unknown>): string | undefined {
    const rule = this.destructive.match(toolName, input);
    if (rule) return `destructive (${rule.verb})`;
    return readsSecrets(toolName, input) ? "reads a secret file" : undefined;
  }
}
