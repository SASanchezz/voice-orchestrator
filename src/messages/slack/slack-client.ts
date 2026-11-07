import { z } from "zod";

export type FetchFn = typeof fetch;
export type Wait = (ms: number) => Promise<void>;

const SLACK_API = "https://slack.com/api/";
const TOO_MANY_REQUESTS = 429;
const MAX_RETRIES = 3;
const MS_PER_SECOND = 1000;
const DEFAULT_RETRY_SECONDS = 5;
/** Slack's errors when a token no longer works. */
const REJECTED_TOKEN = new Set(["invalid_auth", "not_authed", "token_revoked", "token_expired", "account_inactive"]);

const okSchema = z.object({ ok: z.boolean(), error: z.string().optional() });

export type SlackParams = Record<string, string>;

/** The one thing the Slack readers need: call a read method and get its checked response. */
export interface SlackCalls {
  call<Schema extends z.ZodType>(method: string, params: SlackParams, schema: Schema): Promise<z.infer<Schema>>;
}

/** Slack's Web API over fetch with a user token; every response is checked, and rate limits are waited out. */
export class SlackClient implements SlackCalls {
  constructor(
    private token: string,
    private fetchFn: FetchFn,
    private wait: Wait,
  ) {}

  async call<Schema extends z.ZodType>(method: string, params: SlackParams, schema: Schema): Promise<z.infer<Schema>> {
    const response = await this.postWithRetries(method, params);
    if (!response.ok) throw new Error(`Slack ${method} failed with HTTP ${response.status}`);
    const body: unknown = await response.json();
    const { ok, error } = okSchema.parse(body);
    if (!ok) throw new Error(slackErrorText(method, error));
    return schema.parse(body);
  }

  private async postWithRetries(method: string, params: SlackParams): Promise<Response> {
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const response = await this.post(method, params);
      if (response.status !== TOO_MANY_REQUESTS) return response;
      await this.wait(retryAfterMs(response));
    }
    throw new Error(`Slack is rate limiting ${method}; try again in a minute.`);
  }

  private async post(method: string, params: SlackParams): Promise<Response> {
    return this.fetchFn(`${SLACK_API}${method}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(params),
    });
  }
}

function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get("Retry-After"));
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_SECONDS) * MS_PER_SECOND;
}

function slackErrorText(method: string, error = "unknown_error"): string {
  if (REJECTED_TOKEN.has(error)) return `Slack rejected the token (${error}); run npm run slack-login again`;
  return `Slack ${method} failed: ${error}`;
}
