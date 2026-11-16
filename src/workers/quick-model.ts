import { query as sdkQuery, type Options, type Query } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../agent/query-fn.js";
import { envForProfile } from "../config/accounts.js";
import type { AppConfig } from "../config/app-config.js";
import type { Projects } from "../registry/projects.js";

/** Small and fast: its short answers should arrive within seconds. */
const QUICK_MODEL = "haiku";

/**
 * One short answer from a small model, for names and headlines.
 * Runs on the project's own account (work text stays on work), with no tools and no saved session.
 */
export class QuickModel {
  constructor(
    private cfg: AppConfig,
    private projects: Projects,
    private query: QueryFn = sdkQuery,
  ) {}

  /** `purpose` names the answer in errors: "title failed: error_max_turns". */
  async ask(project: string, prompt: string, purpose: string): Promise<string> {
    const run = this.query({ prompt, options: this.optionsFor(project) });
    return QuickModel.resultOf(run, purpose);
  }

  private optionsFor(project: string): Options {
    return {
      cwd: this.cfg.projects[project].path,
      env: envForProfile(this.cfg, this.projects.get(project).profile),
      pathToClaudeCodeExecutable: this.cfg.claudeBin,
      model: QUICK_MODEL,
      settingSources: [],
      tools: [],
      maxTurns: 1,
      persistSession: false,
    };
  }

  private static async resultOf(run: Query, purpose: string): Promise<string> {
    for await (const msg of run) {
      if (msg.type !== "result") continue;
      if (msg.subtype !== "success") throw new Error(`${purpose} failed: ${msg.subtype}`);
      return msg.result;
    }
    throw new Error(`${purpose} ended without a result`);
  }
}
