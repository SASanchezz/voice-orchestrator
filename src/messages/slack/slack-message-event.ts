import { z } from "zod";
import type { ChatKind } from "../replies/inbound.js";

/** Slack's conversation types in a message event, as the app's chat kinds. */
const KINDS: Record<string, ChatKind> = { im: "dm", mpim: "group-dm", channel: "group", group: "group" };
/** Subtypes that are still something a person said; edits, deletions, joins and the like are not. */
const SAID_SUBTYPES = new Set(["file_share", "thread_broadcast"]);

/** The parts of a pushed message event the inbox needs; its text is left out on purpose. */
const messageEventSchema = z.object({
  type: z.literal("message"),
  channel: z.string(),
  channel_type: z.string(),
  user: z.string().optional(),
  bot_id: z.string().optional(),
  subtype: z.string().optional(),
  ts: z.string(),
  thread_ts: z.string().optional(),
});

/** A new message a person sent in a DM, group DM or channel. */
export interface PersonMessage {
  chatId: string;
  chatKind: ChatKind;
  user: string;
  ts: string;
  threadTs?: string;
}

/** The message a pushed event carries, or undefined for anything else: other events, bots, edits, deletions. */
export function personMessageOf(event: unknown): PersonMessage | undefined {
  const parsed = messageEventSchema.safeParse(event);
  if (!parsed.success) return undefined;
  const { channel, channel_type: channelType, user, bot_id: botId, subtype, ts, thread_ts: threadTs } = parsed.data;
  const chatKind = KINDS[channelType];
  const isPerson = Boolean(user) && !botId && (!subtype || SAID_SUBTYPES.has(subtype));
  if (!chatKind || !user || !isPerson) return undefined;
  return { chatId: channel, chatKind, user, ts, threadTs };
}
