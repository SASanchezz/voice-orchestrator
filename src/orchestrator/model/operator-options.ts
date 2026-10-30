import type { Options } from "@anthropic-ai/claude-agent-sdk";
import { envForProfile } from "../../config/accounts.js";
import type { AppConfig } from "../../config/app-config.js";
import { APP_DIR } from "../../config/paths.js";
import { CALENDAR_TOOLS } from "../prompt/system-prompt-text.js";
import type { AgentPrompt } from "../prompt/agent-prompt.js";
import type { OperatorTools } from "../tools/operator-tools.js";
import { BLOCKED_CONNECTOR_TOOLS } from "./blocked-connectors.js";

/**
 * SDK options for the operator's session: its account, its specialized agent with a fresh prompt, and only its own tools
 * and the calendar. The agent runs the main thread always; there is no setting for plain Claude.
 */
export class OperatorOptions {
  constructor(
    private cfg: AppConfig,
    private agent: AgentPrompt,
    private tools: OperatorTools,
  ) {}

  build(): Options {
    const { orchestrator } = this.cfg;
    const definition = this.agent.definition();
    return {
      cwd: APP_DIR,
      // settingSources is empty, so the account's claude.ai connectors (Google Calendar) load only with this flag
      env: { ...envForProfile(this.cfg, orchestrator.profile), ENABLE_CLAUDEAI_MCP_SERVERS: "1" },
      pathToClaudeCodeExecutable: this.cfg.claudeBin,
      model: orchestrator.model,
      // the agent's prompt is the whole system prompt; a systemPrompt option here would take its place
      agent: this.agent.name,
      agents: { [this.agent.name]: definition },
      settingSources: [], // ignore CLAUDE.md etc.; the orchestrator is not a coding agent
      mcpServers: { ctl: this.tools.server() },
      tools: [], // no built-in tools (no Bash/Edit) — it can only act through ctl and the calendar
      allowedTools: ["mcp__ctl__*", ...CALENDAR_TOOLS],
      disallowedTools: BLOCKED_CONNECTOR_TOOLS,
      permissionMode: "dontAsk",
      hooks: this.tools.hooks(),
    };
  }
}
