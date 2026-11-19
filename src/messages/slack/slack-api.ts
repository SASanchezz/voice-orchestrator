import { z } from "zod";

/** The parts of Slack's responses the readers use; anything else Slack sends is ignored. */

export const authTestSchema = z.object({ user_id: z.string() });

const nextPageSchema = z.object({
  response_metadata: z.object({ next_cursor: z.string().optional() }).optional(),
});

const conversationSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  is_im: z.boolean().optional(),
  is_mpim: z.boolean().optional(),
  /** A DM's other person. */
  user: z.string().optional(),
  is_user_deleted: z.boolean().optional(),
});

export const conversationListSchema = nextPageSchema.extend({ channels: z.array(conversationSchema) });

export const conversationInfoSchema = z.object({ channel: conversationSchema });

/** A file shared in a message; Slack sends some (tombstones, external files) with only a few of these. */
const slackFileSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  mimetype: z.string().optional(),
  size: z.number().optional(),
  url_private_download: z.string().optional(),
});

export const slackMessageSchema = z.object({
  ts: z.string(),
  user: z.string().optional(),
  username: z.string().optional(),
  bot_profile: z.object({ name: z.string() }).optional(),
  text: z.string().optional(),
  subtype: z.string().optional(),
  files: z.array(slackFileSchema).optional(),
});

export const historySchema = nextPageSchema.extend({ messages: z.array(slackMessageSchema) });

const searchMatchSchema = slackMessageSchema.extend({
  channel: z.object({ id: z.string(), name: z.string().optional() }),
});

export const searchSchema = z.object({ messages: z.object({ matches: z.array(searchMatchSchema) }) });

const userSchema = z.object({
  name: z.string(),
  real_name: z.string().optional(),
  profile: z.object({ display_name: z.string().optional() }).optional(),
});

export const userInfoSchema = z.object({ user: userSchema });

export const userListSchema = nextPageSchema.extend({ members: z.array(userSchema.extend({ id: z.string() })) });

export type SlackConversationRecord = z.infer<typeof conversationSchema>;
export type SlackUser = z.infer<typeof userSchema>;
export type SlackMessage = z.infer<typeof slackMessageSchema>;
export type SlackFile = z.infer<typeof slackFileSchema>;
export type SlackSearchMatch = z.infer<typeof searchMatchSchema>;

/** A page's cursor for the next one; empty when it was the last. */
export function nextCursorOf(page: z.infer<typeof nextPageSchema>): string {
  return page.response_metadata?.next_cursor ?? "";
}
