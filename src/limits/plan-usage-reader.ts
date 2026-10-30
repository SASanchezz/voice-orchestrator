import { once } from "node:events";
import { query as sdkQuery, type Options, type SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { QueryFn } from "../agent/query-fn.js";
import { envForProfile } from "../config/accounts.js";
import type { AppConfig } from "../config/app-config.js";
import { errorMessage } from "../shared/errors.js";
import type { AccountUsageView, UsageWindowView } from "../ui/plan-usage-views.js";

const READ_TIMEOUT_MS = 15_000;
const WHOLE_PERCENT = 100;

const windowSchema = z.object({ utilization: z.number().nullable(), resets_at: z.string().nullable() });
const usageSchema = z.object({
  rate_limits: z.object({ five_hour: windowSchema.nullish(), seven_day: windowSchema.nullish() }).nullable(),
});
type UsageWindow = z.infer<typeof windowSchema>;

/**
 * Reads what `/usage` shows for each account. Each read starts a Claude Code process that never gets a prompt,
 * so it makes no model call and spends nothing; it has to run under the account's own login.
 */
export class PlanUsageReader {
  constructor(
    private cfg: AppConfig,
    private query: QueryFn = sdkQuery,
  ) {}

  readAll(): Promise<AccountUsageView[]> {
    return Promise.all(Object.keys(this.cfg.profiles).map((account) => this.readOrEmpty(account)));
  }

  /** One account's failure mustn't hide the other's usage. */
  private async readOrEmpty(account: string): Promise<AccountUsageView> {
    try {
      return await this.read(account);
    } catch (error) {
      console.error(`Couldn't read the ${account} account's usage: ${errorMessage(error)}`);
      return { account };
    }
  }

  private async read(account: string): Promise<AccountUsageView> {
    const finished = new AbortController();
    const run = this.query({ prompt: noMessagesUntil(finished.signal), options: this.optionsFor(account) });
    try {
      const usage = run.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true });
      return accountUsage(account, await Promise.race([usage, timedOut()]));
    } finally {
      finished.abort();
      run.close();
    }
  }

  private optionsFor(account: string): Options {
    return {
      env: envForProfile(this.cfg, account),
      pathToClaudeCodeExecutable: this.cfg.claudeBin,
      settingSources: [],
      tools: [],
      persistSession: false,
    };
  }
}

/** Claude Code stays up, waiting for a first message, for as long as this input stays open. */
// oxlint-disable-next-line require-yield
async function* noMessagesUntil(finished: AbortSignal): AsyncGenerator<SDKUserMessage> {
  await once(finished, "abort");
}

async function timedOut(): Promise<never> {
  await once(AbortSignal.timeout(READ_TIMEOUT_MS), "abort");
  throw new Error(`no answer in ${READ_TIMEOUT_MS} ms`);
}

function accountUsage(account: string, usage: unknown): AccountUsageView {
  const limits = usageSchema.parse(usage).rate_limits;
  return { account, fiveHour: remainingIn(limits?.five_hour), week: remainingIn(limits?.seven_day) };
}

function remainingIn(window: UsageWindow | null | undefined): UsageWindowView | undefined {
  if (window?.utilization === null || window?.utilization === undefined) return undefined;
  const remainingPercent = Math.max(0, Math.round(WHOLE_PERCENT - window.utilization));
  return { remainingPercent, resetsAt: window.resets_at ?? undefined };
}
