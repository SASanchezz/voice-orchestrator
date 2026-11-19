import { errorMessage } from "../../shared/errors.js";
import type { ChatRule } from "./chat-rules.js";
import type { ChatRef, InboundMessage, InboundSink } from "./inbound.js";

/** Messages a person sends within this long of their first one are answered with one draft. */
export const BURST_MS = 20_000;

/** The messages to answer with one draft, oldest first, and the chat's rule when the burst ended. */
export interface MessageBurst {
  messages: InboundMessage[];
  rule: ChatRule;
}

/** Where finished bursts go to be drafted. */
export interface DraftRequests {
  requested(burst: MessageBurst): void;
}

export interface RuleLookup {
  ruleFor(chat: ChatRef): ChatRule;
}

/** Runs `run` after `ms`; tests run it when they choose. */
export type Later = (run: () => void, ms: number) => void;

/**
 * Every new message from the feeds comes here. Only chats whose rule says `draft` are kept; a chat's messages are
 * gathered for a short while, per thread, so a burst of several lines gets one draft.
 */
export class ReplyInbox implements InboundSink {
  private bursts = new Map<string, InboundMessage[]>();

  constructor(
    private rules: RuleLookup,
    private drafts: DraftRequests,
    private later: Later,
  ) {}

  received(message: InboundMessage): void {
    if (!this.isDrafted(message)) return;
    const key = ReplyInbox.burstKey(message);
    const waiting = this.bursts.get(key);
    if (waiting) return void waiting.push(message);
    this.bursts.set(key, [message]);
    this.later(() => this.finish(key), BURST_MS);
  }

  private static burstKey({ sourceKey, chatId, threadId }: InboundMessage): string {
    return [sourceKey, chatId, threadId ?? ""].join("|");
  }

  private isDrafted(message: InboundMessage): boolean {
    return this.ruleOf(message)?.mode === "draft";
  }

  /** The rule is read again when the burst ends, so a change made meanwhile applies. */
  private finish(key: string): void {
    const messages = this.bursts.get(key) ?? [];
    this.bursts.delete(key);
    const rule = messages.length ? this.ruleOf(messages[0]) : undefined;
    if (rule?.mode === "draft") this.drafts.requested({ messages, rule });
  }

  /** A damaged rules file stops drafting, loudly, until it is fixed; nothing is drafted against a guessed rule. */
  private ruleOf(chat: ChatRef): ChatRule | undefined {
    try {
      return this.rules.ruleFor(chat);
    } catch (error) {
      console.warn(`[replies] no draft: ${errorMessage(error)}`);
      return undefined;
    }
  }
}
