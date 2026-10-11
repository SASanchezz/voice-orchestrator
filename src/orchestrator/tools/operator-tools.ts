import {
  createSdkMcpServer,
  tool,
  type McpSdkServerConfigWithInstance,
  type Options,
} from "@anthropic-ai/claude-agent-sdk";
import type { ConfirmPhraseGuard } from "./confirm-phrase-guard.js";
import type { OperatorTool } from "./tool-kit.js";

/** The operator's tools: exposed to the model via an in-process MCP server, and to tests via callTool(). */
export class OperatorTools {
  constructor(
    private tools: OperatorTool[],
    private guard: ConfirmPhraseGuard,
  ) {}

  /** Invoke a tool directly (used by tests). Returns the text result. */
  async callTool(name: string, args: Record<string, unknown> = {}): Promise<string> {
    const found = this.tools.find((t) => t.name === name);
    if (!found) throw new Error(`no tool ${name}`);
    const result = await found.call(args);
    return result.content.map((c) => (c.type === "text" ? c.text : `[${c.type}]`)).join("\n");
  }

  server(): McpSdkServerConfigWithInstance {
    const tools = this.tools.map((t) =>
      tool(t.name, t.description, t.args, async (args) => ({ ...(await t.call(args)) })),
    );
    return createSdkMcpServer({ name: "ctl", version: "0.1.0", tools });
  }

  hooks(): Options["hooks"] {
    return { PreToolUse: [{ hooks: [this.guard.hook] }] };
  }
}
