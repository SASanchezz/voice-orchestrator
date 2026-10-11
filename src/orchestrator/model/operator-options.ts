import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { envForProfile } from "../../config/accounts.js";
import type { AppConfig } from "../../config/app-config.js";
import { APP_DIR } from "../../config/paths.js";
import { CALENDAR_TOOLS } from "../prompt/system-prompt-text.js";
import type { SystemPrompt } from "../prompt/system-prompt.js";
import type { OperatorTools } from "../tools/operator-tools.js";

/** SDK options for the operator's session: its account, a fresh system prompt, and only its own tools and the calendar. */
export class OperatorOptions {
  constructor(
    private cfg: AppConfig,
    private prompt: SystemPrompt,
    private tools: OperatorTools,
  ) {}

  build(): Options {
    const { orchestrator } = this.cfg;
    return {
      cwd: APP_DIR,
      // settingSources is empty, so the account's claude.ai connectors (Google Calendar) load only with this flag
      env: { ...envForProfile(this.cfg, orchestrator.profile), ENABLE_CLAUDEAI_MCP_SERVERS: "1" },
      pathToClaudeCodeExecutable: this.cfg.claudeBin,
      model: orchestrator.model,
      systemPrompt: this.prompt.text(),
      settingSources: [], // ignore CLAUDE.md etc.; the orchestrator is not a coding agent
      mcpServers: { ctl: this.tools.server() },
      tools: [], // no built-in tools (no Bash/Edit) — it can only act through ctl and the calendar
      allowedTools: ["mcp__ctl__*", ...CALENDAR_TOOLS],
      permissionMode: "dontAsk",
      hooks: this.tools.hooks(),
    };
  }
}
