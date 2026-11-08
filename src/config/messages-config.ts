import { z } from "zod";

/** `chats: all` reads every Telegram chat with new messages. */
export const ALL_CHATS = "all";

// A key left empty in YAML reads as null; like a missing key, it gets the default.
const missingAsEmpty = (value: unknown): unknown => value ?? {};
const missingAsNone = (value: unknown): unknown => value ?? [];
const missingAsUndefined = (value: unknown): unknown => value ?? undefined;
const names = z.preprocess(missingAsNone, z.array(z.string()));

const slackWorkspaceSchema = z.object({
  /** The Keychain account (-a) the workspace's token is saved under. */
  workspace: z.string(),
  /** The Claude account that summarizes this workspace's messages. */
  profile: z.string(),
  /** Channels read besides DMs and mentions; none unless named here. */
  channels: names,
  /** DMs, group DMs and channels from those read whose new messages are announced as they arrive; none by default. */
  notify: names,
});

const telegramSchema = z.object({
  profile: z.string(),
  /** Missing: no chat is read. */
  chats: z.preprocess(missingAsNone, z.union([z.literal(ALL_CHATS), z.array(z.string())])),
  exclude: names,
  /** Chats from those read whose new messages are announced as they arrive; none by default. */
  notify: names,
});

/** The optional `messages` block; without it, no Slack workspace and no Telegram are read. */
export const messagesSchema = z.preprocess(
  missingAsEmpty,
  z.object({
    slack: z.preprocess(missingAsNone, z.array(slackWorkspaceSchema)),
    telegram: z.preprocess(missingAsUndefined, telegramSchema.optional()),
  }),
);

export type MessagesSettings = z.infer<typeof messagesSchema>;
export type SlackWorkspaceSettings = z.infer<typeof slackWorkspaceSchema>;
export type TelegramSettings = z.infer<typeof telegramSchema>;

/** What a config file without a `messages` block gets: reading messages is off. */
export const DEFAULT_MESSAGES: MessagesSettings = messagesSchema.parse(undefined);

/** Each message source's label and the Claude account it uses, to check the accounts exist. */
export function messageProfiles(settings: MessagesSettings): [string, string][] {
  const slack = settings.slack.map(({ workspace, profile }): [string, string] => [`slack ${workspace}`, profile]);
  const telegram: [string, string][] = settings.telegram ? [["telegram", settings.telegram.profile]] : [];
  return [...slack, ...telegram];
}
