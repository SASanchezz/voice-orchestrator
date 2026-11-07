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

export const slackMessageSchema = z.object({
  ts: z.string(),
  user: z.string().optional(),
  username: z.string().optional(),
  bot_profile: z.object({ name: z.string() }).optional(),
  text: z.string().optional(),
  subtype: z.string().optional(),
  files: z.array(z.unknown()).optional(),
});

export const historySchema = nextPageSchema.extend({ messages: z.array(slackMessageSchema) });

const searchMatchSchema = slackMessageSchema.extend({
  channel: z.object({ id: z.string(), name: z.string().optional() }),
});

export const searchSchema = z.object({ messages: z.object({ matches: z.array(searchMatchSchema) }) });

export const userInfoSchema = z.object({
  user: z.object({
    name: z.string(),
    real_name: z.string().optional(),
    profile: z.object({ display_name: z.string().optional() }).optional(),
  }),
});

export type SlackConversationRecord = z.infer<typeof conversationSchema>;
export type SlackMessage = z.infer<typeof slackMessageSchema>;
export type SlackSearchMatch = z.infer<typeof searchMatchSchema>;

/** A page's cursor for the next one; empty when it was the last. */
export function nextCursorOf(page: z.infer<typeof nextPageSchema>): string {
  return page.response_metadata?.next_cursor ?? "";
}
