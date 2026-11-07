import type { RawMessage } from "../message-types.js";
import { historySchema, nextCursorOf, type SlackMessage } from "./slack-api.js";
import type { SlackCalls } from "./slack-client.js";
import type { SlackWorkspace } from "./slack-workspace.js";

const MS_PER_SECOND = 1000;
const TS_DECIMALS = 6;
const MAX_PAGE_SIZE = 200;
/** Notices about the channel itself, not something someone said. */
const CHANNEL_NOTICES = new Set(["channel_join", "channel_leave", "channel_topic", "channel_purpose", "channel_name"]);
const YOU = "You";

/** A conversation's messages after `oldest` (a Slack ts), newest first, at most `limit` of them, notices included. */
export async function messagesAfter(
  client: SlackCalls,
  conversation: string,
  window: { oldest: string; limit: number },
): Promise<SlackMessage[]> {
  const found: SlackMessage[] = [];
  let cursor = "";
  do {
    const limit = String(Math.min(window.limit - found.length, MAX_PAGE_SIZE));
    const params = { channel: conversation, oldest: window.oldest, limit, cursor };
    const page = await client.call("conversations.history", params, historySchema);
    found.push(...page.messages);
    cursor = nextCursorOf(page);
  } while (cursor && found.length < window.limit);
  return found.slice(0, window.limit);
}

/** Slack messages as the summary reads them, oldest first; files are only noted. */
export async function rawMessages(messages: SlackMessage[], workspace: SlackWorkspace): Promise<RawMessage[]> {
  const raw: RawMessage[] = [];
  for (const message of messages.toReversed()) raw.push(await rawMessage(message, workspace));
  return raw;
}

async function rawMessage(message: SlackMessage, workspace: SlackWorkspace): Promise<RawMessage> {
  return {
    from: await senderName(message, workspace),
    sentAt: dateOfTs(message.ts),
    text: await workspace.names.plainText(message.text ?? ""),
    hasMedia: Boolean(message.files?.length),
  };
}

async function senderName(message: SlackMessage, { names, me }: SlackWorkspace): Promise<string> {
  if (message.user === me) return YOU;
  if (message.user) return names.userName(message.user);
  return message.bot_profile?.name ?? message.username ?? "a bot";
}

export function isSaidBySomeone(message: SlackMessage): boolean {
  return !CHANNEL_NOTICES.has(message.subtype ?? "");
}

export function dateOfTs(ts: string): Date {
  return new Date(Number(ts) * MS_PER_SECOND);
}

export function tsOfDate(date: Date): string {
  return (date.getTime() / MS_PER_SECOND).toFixed(TS_DECIMALS);
}
