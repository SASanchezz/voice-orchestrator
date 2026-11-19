import type { Draft } from "./draft-store.js";

/** How a source delivers a reply you approved, and shows a draft in its own app where it can. */
export interface ReplyChannel {
  send(draft: Draft, text: string): Promise<void>;
  /** Puts the draft in the messenger's own message box, where the messenger allows it. */
  prefill(draft: Draft, text: string): Promise<void>;
  clearPrefill(draft: Draft): Promise<void>;
}

/** Each source's channel, by source key. */
export class ReplyChannels {
  constructor(private channels: Map<string, ReplyChannel>) {}

  of(draft: Draft): ReplyChannel {
    const channel = this.channels.get(draft.sourceKey);
    if (!channel) throw new Error(`${draft.source} has no send: true in config, so replies there aren't sent.`);
    return channel;
  }
}
