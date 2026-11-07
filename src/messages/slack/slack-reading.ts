import { errorMessage } from "../../shared/errors.js";
import { findNamed } from "../chat-names.js";
import type { SourceCursor } from "../cursors.js";
import type { ChatReading, SourceReading } from "../message-types.js";
import { readConversations, type ReadWindow } from "./slack-conversation-reads.js";
import { conversationName, conversationsToRead, type SlackConversation } from "./slack-conversations.js";
import { tsOfDate } from "./slack-history.js";
import { mentionsSince } from "./slack-mentions.js";
import type { SlackWorkspace } from "./slack-workspace.js";

const MAX_CONVERSATION_MESSAGES = 50;
const FULL_CHAT_MESSAGES = 200;
/** The first catch-up ever reads this far back. */
const FIRST_LOOKBACK_MS = 86_400_000;

/** One catch-up on one workspace: DMs and named channels since their cursors, then mentions elsewhere. */
export class SlackReading {
  private sinceTs: string;

  constructor(
    private workspace: SlackWorkspace,
    private cursor: SourceCursor,
    private startedAt: Date,
  ) {
    const lookback = new Date(startedAt.getTime() - FIRST_LOOKBACK_MS);
    this.sinceTs = tsOfDate(cursor.checkedAt ? new Date(cursor.checkedAt) : lookback);
  }

  async everything(channels: string[]): Promise<SourceReading> {
    const conversations = await conversationsToRead(this.workspace.client, channels);
    const read = await readConversations(this.workspace, conversations, this.window(MAX_CONVERSATION_MESSAGES));
    const mentions = await this.mentionsOrNote(new Set(conversations.map((conversation) => conversation.id)));
    const next = { ...this.cursor, chats: this.movedCursors(read.newestTs), checkedAt: this.startedAt.toISOString() };
    return { chats: [...read.chats, ...mentions.chats], notes: [...read.notes, ...mentions.notes], next };
  }

  /** One DM, group DM or named channel, matched loosely by name; the other cursors stay as they are. */
  async oneChat(channels: string[], spoken: string): Promise<SourceReading> {
    const conversations = await conversationsToRead(this.workspace.client, channels);
    const conversation = await this.conversationNamed(conversations, spoken);
    const read = await readConversations(this.workspace, [conversation], this.window(FULL_CHAT_MESSAGES));
    return { chats: read.chats, notes: read.notes, next: { ...this.cursor, chats: this.movedCursors(read.newestTs) } };
  }

  private window(limit: number): ReadWindow {
    return { limit, oldestOf: (conversationId) => this.cursor.chats[conversationId] ?? this.sinceTs };
  }

  private movedCursors(newestTs: Record<string, string>): Record<string, string> {
    return { ...this.cursor.chats, ...newestTs };
  }

  private async conversationNamed(conversations: SlackConversation[], spoken: string): Promise<SlackConversation> {
    const named: { conversation: SlackConversation; name: string }[] = [];
    for (const conversation of conversations)
      named.push({ conversation, name: await conversationName(conversation, this.workspace.names) });
    const found = findNamed(named, spoken, (candidate) => candidate.name);
    if (!found) throw new Error(`no DM or channel like "${spoken}"`);
    return found.conversation;
  }

  /** A missing search scope shouldn't cost the DMs already read, so it becomes a note. */
  private async mentionsOrNote(alreadyRead: Set<string>): Promise<{ chats: ChatReading[]; notes: string[] }> {
    try {
      const chats = await mentionsSince(this.workspace, { sinceTs: this.sinceTs, alreadyRead });
      return { chats, notes: [] };
    } catch (error) {
      return { chats: [], notes: [`Mentions in other channels couldn't be searched (${errorMessage(error)}).`] };
    }
  }
}
