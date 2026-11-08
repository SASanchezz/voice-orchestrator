import { authTestSchema } from "./slack-api.js";
import type { SlackCalls } from "./slack-client.js";
import { SlackNames, type UserNameCache } from "./slack-names.js";
import type { OpenSlack } from "./slack-reader.js";

/** Who is reading which workspace: its API, its people's names, and your own user ID (from auth.test). */
export interface SlackWorkspace {
  client: SlackCalls;
  names: SlackNames;
  me: string;
}

/** Opens the workspace's API with its saved token and asks Slack who you are there. */
export async function openWorkspace(open: OpenSlack, workspace: string, names: UserNameCache): Promise<SlackWorkspace> {
  const client = await open(workspace);
  const { user_id: me } = await client.call("auth.test", {}, authTestSchema);
  return { client, names: new SlackNames(client, names), me };
}
