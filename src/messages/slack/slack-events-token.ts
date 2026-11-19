import { z } from "zod";
import type { FetchFn } from "./slack-client.js";

/** The Keychain service the app-level (xapp-) tokens are saved under, one account per workspace. */
export const SLACK_EVENTS_KEYCHAIN_SERVICE = "voice-orchestrator.slack-events";

const CONNECTIONS_OPEN_URL = "https://slack.com/api/apps.connections.open";
/** App-level tokens start with this; only they can open the Socket Mode connection. */
const APP_TOKEN_PREFIX = "xapp-";

const connectionsOpenSchema = z.object({ ok: z.boolean(), error: z.string().optional(), url: z.string().optional() });

/**
 * Asks Slack for a Socket Mode address with an app-level token, which proves the token works and Socket Mode is on;
 * the address is never connected to. Throws a plain explanation when it fails.
 */
export async function checkEventsToken(token: string, fetchFn: FetchFn): Promise<void> {
  await socketUrl(token, fetchFn);
}

/** A fresh, single-use wss:// address for the Socket Mode connection. */
export async function socketUrl(token: string, fetchFn: FetchFn): Promise<string> {
  if (!token.startsWith(APP_TOKEN_PREFIX))
    throw new Error(`That isn't an app-level token: it should start with ${APP_TOKEN_PREFIX}.`);
  const response = await fetchFn(CONNECTIONS_OPEN_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = connectionsOpenSchema.parse(await response.json());
  if (!body.ok || !body.url) throw new Error(eventsTokenProblem(body.error ?? `HTTP ${response.status}`));
  return body.url;
}

function eventsTokenProblem(error: string): string {
  const hint =
    error === "missing_scope"
      ? " Give the token the connections:write scope."
      : " Check that Socket Mode is on for the app.";
  return `Slack didn't accept the app-level token (${error}).${hint}`;
}
