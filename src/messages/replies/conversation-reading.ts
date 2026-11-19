import type { RawMessage } from "../message-types.js";
import type { InboundMessage } from "./inbound.js";

/** A conversation's latest messages, yours included, read again from the messenger when a draft is made. */
export interface ConversationReading {
  chatName: string;
  /** The Claude account the source's messages are handled on. */
  profile: string;
  /** Oldest first; your own lines are from "You". */
  messages: RawMessage[];
}

/** Reads the conversation a message arrived in, around it; held only while the draft is made. */
export interface ConversationReader {
  read(message: InboundMessage): Promise<ConversationReading>;
}

/** Each source's reader, by source key. */
export class ConversationReaders {
  constructor(private readers: Map<string, ConversationReader>) {}

  async read(message: InboundMessage): Promise<ConversationReading> {
    const reader = this.readers.get(message.sourceKey);
    if (!reader) throw new Error(`nothing reads ${message.source} conversations`);
    return reader.read(message);
  }
}
