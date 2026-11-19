/** Who a reply would go to: one person, a few people, or a channel or group. */
export type ChatKind = "dm" | "group-dm" | "group";

/** A chat, as chat rules and drafts are filed: by source and chat ID, so renaming the chat doesn't lose its rule. */
export interface ChatRef {
  /** e.g. "slack:acme" or "telegram". */
  sourceKey: string;
  chatId: string;
  chatKind: ChatKind;
}

/** A message someone sent you that may need a reply: where, from whom and which message, never its text. */
export interface InboundMessage extends ChatRef {
  /** As shown and spoken, e.g. "Slack acme". */
  source: string;
  from: string;
  /** A Slack ts or a Telegram message ID, as text. */
  messageId: string;
  /** The Slack thread the message is in, so the reply goes there too. */
  threadId?: string;
}

/** Where the Slack and Telegram feeds hand each new message. */
export interface InboundSink {
  received(message: InboundMessage): void;
}

/** A source that hands over new messages as they arrive, for as long as the app runs. */
export interface InboundFeed {
  /** As logged, e.g. "Slack acme". */
  readonly name: string;
  /** Resolves once the feed is listening. */
  start(): Promise<void>;
}
