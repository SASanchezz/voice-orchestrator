import type { ChatReading } from "../message-types.js";
import type { SlackMessage } from "./slack-api.js";
import { conversationName, type SlackConversation } from "./slack-conversations.js";
import { isSaidBySomeone, messagesAfter, rawMessages } from "./slack-history.js";
import type { SlackWorkspace } from "./slack-workspace.js";

/** How much to read: at most `limit` messages per conversation, after each one's own oldest ts. */
export interface ReadWindow {
  limit: number;
  oldestOf(conversationId: string): string;
}

/** The chats with something said, each read conversation's newest ts, and a note on the ones cut at the limit. */
export interface ConversationsRead {
  chats: ChatReading[];
  newestTs: Record<string, string>;
  notes: string[];
}

interface ConversationRead {
  conversationId: string;
  /** Newest first, channel notices included, so the cursor moves past them too. */
  messages: SlackMessage[];
  chat: ChatReading;
}

/** One conversation after another, to stay well inside Slack's rate limits. */
export async function readConversations(
  workspace: SlackWorkspace,
  conversations: SlackConversation[],
  window: ReadWindow,
): Promise<ConversationsRead> {
  const reads: ConversationRead[] = [];
  for (const conversation of conversations) reads.push(await readConversation(workspace, conversation, window));
  const withNews = reads.filter((read) => read.messages.length);
  const busy = withNews.filter((read) => read.messages.length === window.limit).length;
  return {
    chats: withNews.map((read) => read.chat).filter((chat) => chat.messages.length),
    newestTs: Object.fromEntries(withNews.map((read) => [read.conversationId, read.messages[0].ts])),
    notes: busy ? [`Only the latest ${window.limit} messages were read in ${busy} busy conversations.`] : [],
  };
}

async function readConversation(
  workspace: SlackWorkspace,
  conversation: SlackConversation,
  window: ReadWindow,
): Promise<ConversationRead> {
  const oldest = window.oldestOf(conversation.id);
  const messages = await messagesAfter(workspace.client, conversation.id, { oldest, limit: window.limit });
  const said = await rawMessages(messages.filter(isSaidBySomeone), workspace);
  const chat = said.length ? await conversationName(conversation, workspace.names) : conversation.id;
  return { conversationId: conversation.id, messages, chat: { chat, messages: said } };
}
