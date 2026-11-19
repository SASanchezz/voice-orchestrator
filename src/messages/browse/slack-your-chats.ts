import type { BrowsedChatKind, BrowsedChatView } from "../../ui/chat-browse-views.js";
import { conversationListSchema, type SlackConversationRecord } from "../slack/slack-api.js";
import type { SlackCalls } from "../slack/slack-client.js";
import { groupDmName, type SlackNames } from "../slack/slack-names.js";
import { everyPage, type SlackListRequest } from "../slack/slack-pages.js";

const PAGE_SIZE = "200";
const EVERY_KIND = "im,mpim,public_channel,private_channel";
const DIRECT_KINDS = "im,mpim";
const MISSING_SCOPE = "missing_scope";
const KIND_ORDER: BrowsedChatKind[] = ["dm", "group-dm", "group", "channel"];

/** Every conversation you are in, DMs first, then group DMs, then channels, each by name. */
export async function listYourChats(client: SlackCalls, names: SlackNames): Promise<BrowsedChatView[]> {
  const records = await listYourConversations(client);
  const open = records.filter((record) => !record.is_user_deleted);
  const chats = await Promise.all(open.map((record) => chatView(record, names)));
  return chats.toSorted(byKindThenName);
}

/** users.conversations lists only what you are in; Slack refuses the channel kinds until their scopes are granted. */
async function listYourConversations(client: SlackCalls): Promise<SlackConversationRecord[]> {
  try {
    return await listConversations(client, EVERY_KIND);
  } catch (error) {
    const lacksChannelScopes = error instanceof Error && error.message.includes(MISSING_SCOPE);
    if (!lacksChannelScopes) throw error;
    return listConversations(client, DIRECT_KINDS);
  }
}

async function listConversations(client: SlackCalls, types: string): Promise<SlackConversationRecord[]> {
  const request: SlackListRequest = {
    method: "users.conversations",
    params: { types, exclude_archived: "true", limit: PAGE_SIZE },
  };
  const pages = await everyPage(client, request, conversationListSchema);
  return pages.flatMap((page) => page.channels);
}

async function chatView(record: SlackConversationRecord, names: SlackNames): Promise<BrowsedChatView> {
  return { id: record.id, name: await nameOf(record, names), kind: kindOf(record), unread: 0 };
}

function kindOf(record: SlackConversationRecord): BrowsedChatKind {
  if (record.is_im) return "dm";
  return record.is_mpim ? "group-dm" : "channel";
}

/** A DM is named after its person; a group DM after its people; a channel with its #. */
async function nameOf(record: SlackConversationRecord, names: SlackNames): Promise<string> {
  if (record.is_im) return record.user ? names.userName(record.user) : record.id;
  if (record.is_mpim) return groupDmName(record.name ?? record.id);
  return `#${record.name ?? record.id}`;
}

function byKindThenName(first: BrowsedChatView, second: BrowsedChatView): number {
  const byKind = KIND_ORDER.indexOf(first.kind) - KIND_ORDER.indexOf(second.kind);
  return byKind || first.name.localeCompare(second.name);
}
