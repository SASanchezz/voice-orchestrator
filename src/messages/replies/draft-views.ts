import type { ReplyContextLine, ReplyDraftView } from "../../ui/reply-views.js";
import { cleanName, cleanText } from "../sanitize.js";
import type { ConversationReaders } from "./conversation-reading.js";
import type { Draft, DraftStore } from "./draft-store.js";
import type { InboundMessage } from "./inbound.js";

/** How many of the conversation's latest lines a card shows above its draft. */
const CONTEXT_LINES = 8;

/** The drafts waiting for you, newest first, and the conversation each answers, read again when asked. */
export class DraftViews {
  constructor(
    private drafts: DraftStore,
    private readers: ConversationReaders,
  ) {}

  waiting(): ReplyDraftView[] {
    return this.drafts
      .all()
      .filter((draft) => draft.status === "ready")
      .toReversed()
      .map((draft) => DraftViews.viewOf(draft));
  }

  /** Cleaned like everything the app quotes: secrets hidden, links cut to their site, never stored. */
  async context(id: string): Promise<ReplyContextLine[]> {
    const reading = await this.readers.read(DraftViews.latestMessage(this.drafts.find(id)));
    const latest = reading.messages.slice(-CONTEXT_LINES);
    return latest.map(({ from, text, sentAt }) => ({
      from: cleanName(from),
      text: cleanText(text),
      sentAt: sentAt.toISOString(),
    }));
  }

  private static viewOf(draft: Draft): ReplyDraftView {
    const { id, source, chatName, from, chatKind, kind, urgency, text, createdAt } = draft;
    return { id, source, chatName, from, chatKind, kind, urgency, text: text ?? "", createdAt };
  }

  private static latestMessage({
    sourceKey,
    source,
    chatId,
    chatKind,
    from,
    messageIds,
    threadId,
  }: Draft): InboundMessage {
    return { sourceKey, source, chatId, chatKind, from, messageId: messageIds[messageIds.length - 1], threadId };
  }
}
