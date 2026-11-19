import type { Draft, DraftStore } from "./draft-store.js";
import type { MessengerPrefill } from "./messenger-prefill.js";
import type { ReplyChannels } from "./reply-channel.js";
import { requireSendable } from "./sendable-reply.js";

/** Where the drafter files each new draft. */
export interface DraftFiling {
  file(draft: Draft): Promise<void>;
}

/**
 * Everything you do with a draft: it is filed (and shown in Telegram's own message box), edited, dismissed or sent.
 * A reply is sent only from here, only with the exact text you approved, and only once.
 */
export class ReplyDesk implements DraftFiling {
  /** Drafts on their way out: a second Send meanwhile (a double click, or a click and your voice) is refused. */
  private sending = new Set<string>();

  constructor(
    private drafts: DraftStore,
    private channels: ReplyChannels,
    private prefill: MessengerPrefill,
  ) {}

  async file(draft: Draft): Promise<void> {
    this.drafts.add(draft);
    if (draft.status === "ready" && draft.text) await this.prefill.show(draft, draft.text);
  }

  async edit(id: string, text: string): Promise<Draft> {
    const draft = this.drafts.update(this.waiting(id).id, { text });
    await this.prefill.show(draft, text);
    return draft;
  }

  async dismiss(id: string): Promise<Draft> {
    const draft = this.drafts.update(this.waiting(id).id, { status: "dismissed" });
    await this.prefill.clear(draft);
    return draft;
  }

  /** `approvedText` is what you saw when you clicked Send or said "confirm send"; it is sent exactly as it is. */
  async send(id: string, approvedText: string): Promise<Draft> {
    if (this.sending.has(id)) throw new Error("That reply is already being sent.");
    this.sending.add(id);
    try {
      return await this.sendOnce(this.waiting(id), approvedText);
    } finally {
      this.sending.delete(id);
    }
  }

  private async sendOnce(draft: Draft, approvedText: string): Promise<Draft> {
    requireSendable(approvedText);
    await this.channels.of(draft).send(draft, approvedText);
    const sentAt = new Date().toISOString();
    const sent = this.drafts.update(draft.id, { status: "sent", text: approvedText, sentAt });
    await this.prefill.clear(sent);
    return sent;
  }

  /** Sent and dismissed drafts are done with; so is one that needed no reply. */
  private waiting(id: string): Draft {
    const draft = this.drafts.find(id);
    if (draft.status !== "ready") throw new Error(`That draft is ${draft.status}; there is nothing to do with it.`);
    return draft;
  }
}
