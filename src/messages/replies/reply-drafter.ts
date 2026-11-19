import { errorMessage } from "../../shared/errors.js";
import { hideSecrets } from "../hidden-secrets.js";
import type { ConversationReaders } from "./conversation-reading.js";
import { newDraft, type Draft } from "./draft-store.js";
import { quotedConversation } from "./quoted-conversation.js";
import type { DraftRequests, MessageBurst } from "./reply-inbox.js";
import { triageOf } from "./reply-triage.js";
import { writtenReply, type WriterPrompt } from "./reply-writer.js";
import type { ToolFreeModel } from "./tool-free-model.js";

/** Where each draft goes, and where a burst that couldn't be drafted is reported. */
export interface DraftOutcomes {
  file(draft: Draft): Promise<void>;
  failed(source: string, reason: string): void;
}

/** A draft longer than this is cut; chat replies are short. */
const MAX_DRAFT_CHARS = 2_000;

/**
 * Turns each finished burst into a draft, one burst at a time: reads the conversation again, sorts it, writes the
 * reply when one is needed, hides anything secret-looking in it, and files it. Nothing is ever sent from here.
 */
export class ReplyDrafter implements DraftRequests {
  private queue = Promise.resolve();

  constructor(
    private readers: ConversationReaders,
    private model: ToolFreeModel,
    private outcomes: DraftOutcomes,
  ) {}

  requested(burst: MessageBurst): void {
    this.queue = this.queue.then(async () => this.draftOrLog(burst));
  }

  /** Waits for every burst asked for so far. */
  async settled(): Promise<void> {
    await this.queue;
  }

  private async draftOrLog(burst: MessageBurst): Promise<void> {
    try {
      const draft = await this.draft(burst);
      await this.outcomes.file(draft);
      console.log(`[replies] ${draft.source}: ${ReplyDrafter.outcome(draft)}`);
    } catch (error) {
      const { source } = burst.messages[0];
      console.warn(`[replies] ${source}: no draft: ${errorMessage(error)}`);
      this.outcomes.failed(source, errorMessage(error));
    }
  }

  private async draft({ messages, rule }: MessageBurst): Promise<Draft> {
    const reading = await this.readers.read(messages[messages.length - 1]);
    const quoted = quotedConversation(reading);
    const triage = await triageOf(this.model, reading.profile, quoted);
    const text = triage.needsReply ? await this.reply(reading.profile, { quoted, triage, note: rule.note }) : undefined;
    return newDraft(messages, reading.chatName, { triage, text });
  }

  /** Secrets are hidden in the draft itself too: the model may have repeated one, or made one up. */
  private async reply(profile: string, prompt: WriterPrompt): Promise<string> {
    const written = await writtenReply(this.model, profile, prompt);
    return hideSecrets(written).slice(0, MAX_DRAFT_CHARS).trim();
  }

  /** Logged by kind and count only: no names, no text. */
  private static outcome({ status, chatKind, kind, urgency }: Draft): string {
    if (status === "no-reply") return `no reply needed in a ${chatKind} (${kind})`;
    return `draft ready for a ${chatKind} (${kind}, ${urgency} urgency)`;
  }
}
