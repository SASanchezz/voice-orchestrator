import type { Options, Query, SDKResultMessage } from "@anthropic-ai/claude-agent-sdk";
import type { QueryFn } from "../../agent/query-fn.js";
import { envForProfile } from "../../config/accounts.js";
import type { AppConfig } from "../../config/app-config.js";

const MAX_TURNS = 1;

/** One job for the model: which model does it, and the rules it is given. */
export interface ModelRole {
  name: string;
  model: string;
  systemPrompt: string;
}

/**
 * One question to a fresh session on the given Claude account: no tools, no settings, nothing kept on disk, one turn.
 * Quoted messages can't make it do anything, because there is nothing it can do but answer.
 */
export class ToolFreeModel {
  constructor(
    private cfg: AppConfig,
    private query: QueryFn,
  ) {}

  /** Throws when the model gives no answer. */
  async ask(role: ModelRole, profile: string, prompt: string): Promise<string> {
    const run = this.query({ prompt, options: this.options(role, profile) });
    return ToolFreeModel.answerOf(role, run);
  }

  private static async answerOf(role: ModelRole, run: Query): Promise<string> {
    let answer: string | undefined;
    for await (const message of run) if (message.type === "result") answer = ToolFreeModel.resultText(role, message);
    if (!answer) throw new Error(`the ${role.name} gave no answer`);
    return answer;
  }

  private static resultText(role: ModelRole, message: SDKResultMessage): string {
    if (message.subtype !== "success") throw new Error(`the ${role.name} stopped (${message.subtype})`);
    return message.result.trim();
  }

  private options({ model, systemPrompt }: ModelRole, profile: string): Options {
    return {
      model,
      env: envForProfile(this.cfg, profile),
      pathToClaudeCodeExecutable: this.cfg.claudeBin,
      settingSources: [],
      tools: [],
      systemPrompt,
      persistSession: false,
      maxTurns: MAX_TURNS,
    };
  }
}
