import type { SlackMessage } from "./slack-api.js";
import { isSaidBySomeone, messagesAfter, senderName } from "./slack-history.js";
import type { WatchedConversation } from "./slack-watched.js";
import type { SlackWorkspace } from "./slack-workspace.js";

/** One check reads at most this many new messages per conversation; announcing needs only the count and senders. */
const MAX_NEW_MESSAGES = 20;
/** Before the first message: everything after it is new. */
const BEFORE_ANY_MESSAGE = "0";

/** A new message's chat and sender. */
export type HeardMessage = (chat: string, from: string) => void;

/**
 * Asks Slack for messages after the newest one seen in each watched conversation. The first check only notes
 * where each conversation stands, so what was there before the app started isn't announced.
 */
export class SlackNewMessages {
  private newestSeen = new Map<string, string>();

  constructor(
    private workspace: SlackWorkspace,
    private watched: WatchedConversation[],
    private heard: HeardMessage,
  ) {}

  async check(): Promise<void> {
    for (const conversation of this.watched) await this.checkConversation(conversation);
  }

  private async checkConversation(conversation: WatchedConversation): Promise<void> {
    const newestSeen = this.newestSeen.get(conversation.id);
    if (!newestSeen) return this.noteNewest(conversation);
    const window = { oldest: newestSeen, limit: MAX_NEW_MESSAGES };
    const messages = await messagesAfter(this.workspace.client, conversation.id, window);
    if (!messages.length) return;
    this.newestSeen.set(conversation.id, messages[0].ts);
    for (const message of messages.toReversed().filter((found) => this.isFromOthers(found)))
      this.heard(conversation.name, await senderName(message, this.workspace));
  }

  private async noteNewest(conversation: WatchedConversation): Promise<void> {
    const window = { oldest: BEFORE_ANY_MESSAGE, limit: 1 };
    const [newest] = await messagesAfter(this.workspace.client, conversation.id, window);
    this.newestSeen.set(conversation.id, newest?.ts ?? BEFORE_ANY_MESSAGE);
  }

  private isFromOthers(message: SlackMessage): boolean {
    return isSaidBySomeone(message) && message.user !== this.workspace.me;
  }
}
