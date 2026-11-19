import type { Draft } from "../messages/replies/draft-store.js";
import type { ReplyChannel } from "../messages/replies/reply-channel.js";

/** A channel that records what it was asked to do; a send can be made to fail. No network. */
export class RecordingChannel implements ReplyChannel {
  readonly sent: string[] = [];
  readonly prefilled: string[] = [];
  cleared = 0;
  failSend?: Error;
  private held?: Promise<void>;
  private letGoOfSends: () => void = () => {};

  /** Holds every send until letGo(), to catch a second send meanwhile. */
  hold(): void {
    this.held = new Promise((resolve) => (this.letGoOfSends = resolve));
  }

  letGo(): void {
    this.letGoOfSends();
  }

  async send(_draft: Draft, text: string): Promise<void> {
    await this.held;
    if (this.failSend) throw this.failSend;
    this.sent.push(text);
  }

  async prefill(_draft: Draft, text: string): Promise<void> {
    this.prefilled.push(text);
  }

  async clearPrefill(): Promise<void> {
    this.cleared++;
  }
}
