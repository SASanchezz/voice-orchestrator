import type { Draft } from "./draft-store.js";
import type { InboundMessage, InboundSink } from "./inbound.js";
import type { DraftFiling } from "./reply-desk.js";
import type { DraftOutcomes } from "./reply-drafter.js";

/** What a source's live feed has done since the app started; counts and times only, never message text. */
export interface SourceHealth {
  feed: "not started" | "listening" | "failed";
  feedError?: string;
  /** Everything the messenger pushed (Slack only): any event, yours and bots' included. */
  heard: number;
  /** Messages from people in chats that are drafted for. */
  passed: number;
  lastPassed?: Date;
  drafted: number;
  notNeeded: number;
  lastDrafted?: Date;
  lastFailure?: string;
}

const NOTHING_YET: SourceHealth = { feed: "not started", heard: 0, passed: 0, drafted: 0, notNeeded: 0 };

/** Keeps each source's counts in memory, for the setup checkup. */
export class ReplyHealth {
  private sources = new Map<string, SourceHealth>();

  of(source: string): SourceHealth {
    return this.sources.get(source) ?? NOTHING_YET;
  }

  feedStarted(source: string): void {
    this.update(source, { feed: "listening", feedError: undefined });
  }

  feedFailed(source: string, error: string): void {
    this.update(source, { feed: "failed", feedError: error });
  }

  heard(source: string): void {
    this.update(source, { heard: this.of(source).heard + 1 });
  }

  passed(source: string): void {
    this.update(source, { passed: this.of(source).passed + 1, lastPassed: new Date() });
  }

  filed({ source, status }: Draft): void {
    const { drafted, notNeeded } = this.of(source);
    const counts = status === "ready" ? { drafted: drafted + 1 } : { notNeeded: notNeeded + 1 };
    this.update(source, { ...counts, lastDrafted: new Date() });
  }

  draftFailed(source: string, reason: string): void {
    this.update(source, { lastFailure: reason });
  }

  private update(source: string, change: Partial<SourceHealth>): void {
    this.sources.set(source, { ...this.of(source), ...change });
  }
}

/** The inbox, counting each message that reaches it, and each raw event a feed reports. */
export class CountedInbox implements InboundSink {
  constructor(
    private inbox: InboundSink,
    private health: ReplyHealth,
  ) {}

  received(message: InboundMessage): void {
    this.health.passed(message.source);
    this.inbox.received(message);
  }

  heard(source: string): void {
    this.health.heard(source);
  }
}

/** Files each draft, and counts it or the reason it couldn't be made. */
export class RecordedDrafts implements DraftOutcomes {
  constructor(
    private filing: DraftFiling,
    private health: ReplyHealth,
  ) {}

  async file(draft: Draft): Promise<void> {
    await this.filing.file(draft);
    this.health.filed(draft);
  }

  failed(source: string, reason: string): void {
    this.health.draftFailed(source, reason);
  }
}
