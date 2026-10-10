import { query as sdkQuery } from "@anthropic-ai/claude-agent-sdk";
import { envForProfile, type AppConfig } from "./config.js";
import type { Registry } from "./registry.js";
import type { QueryFn } from "./workers.js";

/** Small and fast: the explanation should be on the card within seconds. */
const EXPLAINER_MODEL = "haiku";

/**
 * Explains a worker's command in plain words for someone who doesn't read code, with how risky it is.
 * Runs on the project's own account (work code stays on work), with no tools and no saved session.
 */
export class CommandExplainer {
  constructor(
    private cfg: AppConfig,
    private registry: Registry,
    private query: QueryFn = sdkQuery,
  ) {}

  async explain(project: string, command: string): Promise<string> {
    const folder = this.cfg.projects[project].path;
    const q = this.query({
      prompt: explanationPrompt(folder, command),
      options: {
        cwd: folder,
        env: envForProfile(this.cfg, this.registry.get(project).profile),
        pathToClaudeCodeExecutable: this.cfg.claudeBin,
        model: EXPLAINER_MODEL,
        settingSources: [],
        tools: [],
        maxTurns: 1,
        persistSession: false,
      },
    });
    for await (const msg of q) {
      if (msg.type !== "result") continue;
      if (msg.subtype !== "success") throw new Error(`explanation failed: ${msg.subtype}`);
      return msg.result.trim();
    }
    throw new Error("explanation ended without a result");
  }
}

function explanationPrompt(folder: string, command: string): string {
  return (
    `A coding assistant working in the folder ${folder} asks permission to run this:\n\n${command}\n\n` +
    "Explain it to someone who doesn't read code, in at most two short plain sentences (under 40 words in all). " +
    "First what it will do: which folders or files it deletes, what it changes or rewrites, which database, server or remote it touches. " +
    'Then "Risk: low", "Risk: medium" or "Risk: high", with a few words why. No code, no markdown, no preamble.'
  );
}
