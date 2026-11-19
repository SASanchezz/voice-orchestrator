import type { SlackWorkspaceSettings } from "../../config/messages-config.js";
import type { ConversationReader, ConversationReading } from "../replies/conversation-reading.js";
import type { InboundMessage } from "../replies/inbound.js";
import { conversationInfoSchema, historySchema, type SlackMessage } from "./slack-api.js";
import { isSaidBySomeone, messagesAfter, rawMessages } from "./slack-history.js";
import { groupDmName, type UserNameCache } from "./slack-names.js";
import type { OpenSlack } from "./slack-reader.js";
import { openWorkspace, type SlackWorkspace } from "./slack-workspace.js";

/** How many of the latest messages a draft is made from. */
const RECENT_MESSAGES = 15;
/** A thread is read from its start, so this many replies are asked for and the latest kept. */
const MAX_THREAD_REPLIES = 200;
const FROM_THE_START = "0";

/** Reads a Slack conversation, or the thread a message is in, around a new message; only read methods are called. */
export class SlackConversationReader implements ConversationReader {
  private userNames: UserNameCache = new Map();

  constructor(
    private settings: SlackWorkspaceSettings,
    private open: OpenSlack,
  ) {}

  async read(message: InboundMessage): Promise<ConversationReading> {
    const workspace = await openWorkspace(this.open, this.settings.workspace, this.userNames);
    const recent = await this.recent(workspace, message);
    const chatName = await this.chatName(workspace, message);
    return { chatName, profile: this.settings.profile, messages: await rawMessages(recent, workspace) };
  }

  /** Newest first, as rawMessages takes them. */
  private async recent(workspace: SlackWorkspace, { chatId, threadId }: InboundMessage): Promise<SlackMessage[]> {
    const messages = threadId
      ? await this.threadReplies(workspace, chatId, threadId)
      : await messagesAfter(workspace.client, chatId, { oldest: FROM_THE_START, limit: RECENT_MESSAGES });
    return messages.filter(isSaidBySomeone);
  }

  private async threadReplies(workspace: SlackWorkspace, chatId: string, threadId: string): Promise<SlackMessage[]> {
    const params = { channel: chatId, ts: threadId, limit: String(MAX_THREAD_REPLIES) };
    const { messages } = await workspace.client.call("conversations.replies", params, historySchema);
    return messages.slice(-RECENT_MESSAGES).toReversed();
  }

  /** A DM is named after its person; a group DM or channel by Slack's name for it. */
  private async chatName(workspace: SlackWorkspace, { chatId, chatKind, from }: InboundMessage): Promise<string> {
    if (chatKind === "dm") return from;
    const { channel } = await workspace.client.call("conversations.info", { channel: chatId }, conversationInfoSchema);
    const name = channel.name ?? chatId;
    return channel.is_mpim ? groupDmName(name) : `#${name}`;
  }
}
