import { errorMessage } from "../../shared/errors.js";
import type { Draft } from "./draft-store.js";
import type { ReplyChannels } from "./reply-channel.js";

/**
 * Keeps a draft in the messenger's own message box where it can (Telegram). It is a convenience: when it fails, the
 * draft is still in the app, so the failure is only logged.
 */
export class MessengerPrefill {
  constructor(private channels: ReplyChannels) {}

  async show(draft: Draft, text: string): Promise<void> {
    await this.quietly(draft, async () => this.channels.of(draft).prefill(draft, text));
  }

  async clear(draft: Draft): Promise<void> {
    await this.quietly(draft, async () => this.channels.of(draft).clearPrefill(draft));
  }

  private async quietly(draft: Draft, act: () => Promise<void>): Promise<void> {
    try {
      await act();
    } catch (error) {
      console.warn(`[replies] ${draft.source}: the messenger's own draft wasn't updated: ${errorMessage(error)}`);
    }
  }
}
