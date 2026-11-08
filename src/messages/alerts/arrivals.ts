/** A message that just arrived in a watched chat: where and from whom, never its text. */
export interface Arrival {
  /** As spoken, e.g. "Telegram" or "Slack acme". */
  source: string;
  chat: string;
  from: string;
}

/** Where watches report each arrival. */
export interface ArrivalSink {
  heard(arrival: Arrival): void;
}

/** A source that tells of new messages in the chats under its `notify`, as they arrive. */
export interface MessageWatch {
  /** As spoken and logged, e.g. "Slack acme". */
  readonly name: string;
  /** Starts watching; resolves once it does, and keeps watching for as long as the app runs. */
  start(): Promise<void>;
}
