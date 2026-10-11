import type { SDKUserMessage } from "@anthropic-ai/claude-agent-sdk";

/** Async queue feeding the long-lived orchestrator session (SDK streaming input mode). */
export class Inbox implements AsyncIterable<SDKUserMessage> {
  private items: SDKUserMessage[] = [];
  private waiter?: (result: IteratorResult<SDKUserMessage>) => void;
  private closed = false;

  push(content: string): void {
    const message: SDKUserMessage = {
      type: "user",
      message: { role: "user", content },
      parent_tool_use_id: null,
      origin: { kind: "human" },
    };
    const waiter = this.waiter;
    this.waiter = undefined;
    if (waiter) waiter({ value: message, done: false });
    else this.items.push(message);
  }

  close(): void {
    this.closed = true;
    this.waiter?.({ value: undefined, done: true });
  }

  [Symbol.asyncIterator](): AsyncIterator<SDKUserMessage> {
    return { next: () => this.next() };
  }

  private next(): Promise<IteratorResult<SDKUserMessage>> {
    const item = this.items.shift();
    if (item) return Promise.resolve({ value: item, done: false });
    if (this.closed) return Promise.resolve({ value: undefined, done: true });
    return new Promise((resolve) => (this.waiter = resolve));
  }
}
