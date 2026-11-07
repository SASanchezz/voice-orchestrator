import type { SlackCalls } from "./slack-client.js";
import type { SlackNames } from "./slack-names.js";

/** Who is reading which workspace: its API, its people's names, and your own user ID (from auth.test). */
export interface SlackWorkspace {
  client: SlackCalls;
  names: SlackNames;
  me: string;
}
