import type { ChatReading } from "../message-types.js";
import { searchSchema, type SlackSearchMatch } from "./slack-api.js";
import { dateOfTs, rawMessages } from "./slack-history.js";
import type { SlackWorkspace } from "./slack-workspace.js";

const MS_PER_DAY = 86_400_000;
const DATE_CHARS = 10;
const MAX_MENTIONS = "100";

/** Where to look for mentions: after this ts, in conversations not read already. */
export interface MentionSearch {
  sinceTs: string;
  alreadyRead: Set<string>;
}

/** Messages mentioning you since the cursor, one chat per channel, from search.messages. */
export async function mentionsSince(workspace: SlackWorkspace, search: MentionSearch): Promise<ChatReading[]> {
  const query = mentionQuery(workspace.me, search.sinceTs);
  const params = { query, sort: "timestamp", sort_dir: "desc", count: MAX_MENTIONS };
  const { messages } = await workspace.client.call("search.messages", params, searchSchema);
  const fresh = messages.matches.filter((match) => isNewElsewhere(match, search));
  const chats: ChatReading[] = [];
  for (const [channel, matches] of byChannel(fresh)) {
    chats.push({ chat: `mentions in ${channel}`, messages: await rawMessages(matches, workspace) });
  }
  return chats;
}

/** search's after: is whole days in your time zone and excludes that day, so it starts a day early. */
function mentionQuery(me: string, sinceTs: string): string {
  const dayBefore = new Date(dateOfTs(sinceTs).getTime() - MS_PER_DAY);
  return `<@${me}> after:${dayBefore.toISOString().slice(0, DATE_CHARS)}`;
}

function isNewElsewhere(match: SlackSearchMatch, { sinceTs, alreadyRead }: MentionSearch): boolean {
  return Number(match.ts) > Number(sinceTs) && !alreadyRead.has(match.channel.id);
}

function byChannel(matches: SlackSearchMatch[]): Map<string, SlackSearchMatch[]> {
  const grouped = new Map<string, SlackSearchMatch[]>();
  for (const match of matches) {
    const channel = `#${match.channel.name ?? match.channel.id}`;
    grouped.set(channel, [...(grouped.get(channel) ?? []), match]);
  }
  return grouped;
}
