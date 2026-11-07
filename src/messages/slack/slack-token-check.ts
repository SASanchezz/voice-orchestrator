import { z } from "zod";
import type { FetchFn } from "./slack-client.js";

const AUTH_TEST_URL = "https://slack.com/api/auth.test";
/** User tokens start with this; bot tokens (xoxb-) can't read your DMs. */
const USER_TOKEN_PREFIX = "xoxp-";
const SCOPES_HEADER = "x-oauth-scopes";

const authTestSchema = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  team: z.string().optional(),
  user: z.string().optional(),
});

/** Who the token belongs to, and which of the needed scopes it lacks. */
export interface TokenCheck {
  team: string;
  user: string;
  missingScopes: string[];
}

/** Asks Slack's auth.test whether a pasted token works; throws a plain explanation when it doesn't. */
export async function checkSlackToken(token: string, needed: string[], fetchFn: FetchFn): Promise<TokenCheck> {
  if (!token.startsWith(USER_TOKEN_PREFIX))
    throw new Error(`That isn't a user token: it should start with ${USER_TOKEN_PREFIX} (the User OAuth Token).`);
  const response = await fetchFn(AUTH_TEST_URL, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
  const body = authTestSchema.parse(await response.json());
  if (!body.ok) throw new Error(`Slack didn't accept the token (${body.error ?? `HTTP ${response.status}`}).`);
  const granted = new Set((response.headers.get(SCOPES_HEADER) ?? "").split(","));
  const missingScopes = needed.filter((scope) => !granted.has(scope));
  return { team: body.team ?? "your workspace", user: body.user ?? "you", missingScopes };
}
