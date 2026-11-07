import { isNamed } from "../chat-names.js";
import { conversationListSchema, nextCursorOf, type SlackConversationRecord } from "./slack-api.js";
import type { SlackCalls, SlackParams } from "./slack-client.js";
import { groupDmName, type SlackNames } from "./slack-names.js";

const PAGE_SIZE = "200";
const DIRECT_TYPES = "im,mpim";
const CHANNEL_TYPES = "public_channel,private_channel";

/** A DM, group DM or channel the reader looks into. */
export interface SlackConversation {
  id: string;
  /** Set for channels and group DMs; a DM is named after its person, looked up only when needed. */
  name?: string;
  dmUser?: string;
}

/** Your DMs and group DMs, plus the channels named in config. */
export async function conversationsToRead(client: SlackCalls, channelNames: string[]): Promise<SlackConversation[]> {
  const direct = await listAll(client, { types: DIRECT_TYPES });
  const channels = channelNames.length ? await namedChannels(client, channelNames) : [];
  return [...direct.filter(isOpenDm).map(directConversation), ...channels];
}

export async function conversationName(conversation: SlackConversation, names: SlackNames): Promise<string> {
  if (conversation.name) return conversation.name;
  return conversation.dmUser ? names.userName(conversation.dmUser) : conversation.id;
}

async function namedChannels(client: SlackCalls, channelNames: string[]): Promise<SlackConversation[]> {
  const channels = await listAll(client, { types: CHANNEL_TYPES });
  const wanted = channels.filter((channel) => channelNames.some((name) => isNamed(channel.name ?? "", name)));
  return wanted.map((channel) => ({ id: channel.id, name: `#${channel.name ?? channel.id}` }));
}

/** Every page of conversations.list. */
async function listAll(client: SlackCalls, params: SlackParams): Promise<SlackConversationRecord[]> {
  const found: SlackConversationRecord[] = [];
  let cursor = "";
  do {
    const page = await client.call(
      "conversations.list",
      { ...params, exclude_archived: "true", limit: PAGE_SIZE, cursor },
      conversationListSchema,
    );
    found.push(...page.channels);
    cursor = nextCursorOf(page);
  } while (cursor);
  return found;
}

function isOpenDm(record: SlackConversationRecord): boolean {
  return !record.is_user_deleted;
}

function directConversation(record: SlackConversationRecord): SlackConversation {
  if (record.is_mpim) return { id: record.id, name: groupDmName(record.name ?? record.id) };
  return { id: record.id, dmUser: record.user };
}
