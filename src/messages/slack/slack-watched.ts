import { unmatchedNames } from "../alerts/watched-names.js";
import { isNamed } from "../chat-names.js";
import { conversationName, conversationsToRead } from "./slack-conversations.js";
import type { SlackWorkspace } from "./slack-workspace.js";

/** A DM, group DM or channel whose new messages are announced. */
export interface WatchedConversation {
  id: string;
  name: string;
}

/**
 * The conversations the catch-up reads whose names are under `notify`. A DM is named after its person, which costs
 * a users.info call, so the search stops as soon as every name is found.
 */
export async function watchedConversations(
  workspace: SlackWorkspace,
  settings: { channels: string[]; notify: string[] },
): Promise<WatchedConversation[]> {
  const watched: WatchedConversation[] = [];
  for (const conversation of await conversationsToRead(workspace.client, settings.channels)) {
    const missing = unmatchedNames(settings.notify, namesOf(watched));
    if (!missing.length) break;
    const name = await conversationName(conversation, workspace.names);
    const isWanted = missing.some((wanted) => isNamed(name, wanted));
    if (isWanted) watched.push({ id: conversation.id, name });
  }
  return watched;
}

export function namesOf(watched: WatchedConversation[]): string[] {
  return watched.map((conversation) => conversation.name);
}
