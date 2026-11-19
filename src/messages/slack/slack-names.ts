import { userInfoSchema, userListSchema, type SlackUser } from "./slack-api.js";
import type { SlackCalls } from "./slack-client.js";
import { everyPage, type SlackListRequest } from "./slack-pages.js";

/** Slack user IDs to display names, kept in memory only for as long as the app runs. */
export type UserNameCache = Map<string, string>;

const USER_MENTION = /<@([A-Z0-9]+)(?:\|[^>]*)?>/g;
const CHANNEL_MENTION = /<#[A-Z0-9]+\|([^>]*)>/g;
const SPECIAL_MENTION = /<!(here|channel|everyone)(?:\|[^>]*)?>/g;
const LABELED_LINK = /<((?:https?|mailto):[^|>]+)\|[^>]*>/g;
const BARE_LINK = /<((?:https?|mailto):[^>]+)>/g;
const MPIM_PREFIX = /^mpdm-/;
const MPIM_SUFFIX = /-\d+$/;
const MPIM_SEPARATOR = "--";
/** Slack takes up to 1000 users a page; fewer pages keep well within users.list's rate limit. */
const EVERYONE: SlackListRequest = { method: "users.list", params: { limit: "1000" } };

/** Turns user IDs into names, asking users.info once per user. */
export class SlackNames {
  constructor(
    private client: SlackCalls,
    private cache: UserNameCache,
  ) {}

  async userName(userId: string): Promise<string> {
    const known = this.cache.get(userId);
    if (known) return known;
    const { user } = await this.client.call("users.info", { user: userId }, userInfoSchema);
    const name = SlackNames.displayName(user);
    this.cache.set(userId, name);
    return name;
  }

  /** Everyone's name at once, a page of users.list at a time, so naming many DMs doesn't ask once per person. */
  async learnEveryone(): Promise<void> {
    const pages = await everyPage(this.client, EVERYONE, userListSchema);
    for (const user of pages.flatMap((page) => page.members)) this.cache.set(user.id, SlackNames.displayName(user));
  }

  /** Slack's markup as plain text: "<@U1>" becomes "@Bob", "<#C1|general>" "#general", and a link its address. */
  async plainText(text: string): Promise<string> {
    const named = await this.withUserNames(text);
    return named
      .replace(CHANNEL_MENTION, "#$1")
      .replace(SPECIAL_MENTION, "@$1")
      .replace(LABELED_LINK, "$1")
      .replace(BARE_LINK, "$1");
  }

  private async withUserNames(text: string): Promise<string> {
    const userIds = [...text.matchAll(USER_MENTION)].map(([, userId]) => userId);
    for (const userId of new Set(userIds)) await this.userName(userId);
    return text.replace(USER_MENTION, (_mention, userId: string) => `@${this.cache.get(userId) ?? userId}`);
  }

  /** The name Slack shows: the display name, else the full name, else the handle. */
  private static displayName(user: SlackUser): string {
    return user.profile?.display_name || user.real_name || user.name;
  }
}

/** A group DM's name as Slack makes it ("mpdm-ann--bob--cy-1") read as "ann, bob, cy". */
export function groupDmName(name: string): string {
  return name.replace(MPIM_PREFIX, "").replace(MPIM_SUFFIX, "").split(MPIM_SEPARATOR).join(", ");
}
