import { isSaidBySomeone, messagesAfter, tsOfDate } from "./slack-history.js";
import type { SlackConversation } from "./slack-conversations.js";
import type { PersonMessage } from "./slack-message-event.js";
import type { SlackWorkspace } from "./slack-workspace.js";

/** A catch-up after a drop reads at most this many messages per conversation. */
const MAX_MISSED_PER_CONVERSATION = 20;

/** What people sent in the conversations since `since`, oldest first; your own messages and bots' are left out. */
export async function missedMessages(
  workspace: SlackWorkspace,
  conversations: SlackConversation[],
  since: Date,
): Promise<PersonMessage[]> {
  const missed: PersonMessage[] = [];
  for (const conversation of conversations) missed.push(...(await missedIn(workspace, conversation, since)));
  return missed;
}

async function missedIn(
  workspace: SlackWorkspace,
  conversation: SlackConversation,
  since: Date,
): Promise<PersonMessage[]> {
  const window = { oldest: tsOfDate(since), limit: MAX_MISSED_PER_CONVERSATION };
  const messages = await messagesAfter(workspace.client, conversation.id, window);
  const fromOthers = messages.filter((message) => isSaidBySomeone(message) && !message.subtype);
  const people = fromOthers.filter((message) => message.user && message.user !== workspace.me);
  return people.toReversed().map((message) => personMessage(conversation, message.user ?? "", message.ts));
}

function personMessage(conversation: SlackConversation, user: string, ts: string): PersonMessage {
  return { chatId: conversation.id, chatKind: conversation.kind, user, ts };
}
