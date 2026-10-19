import type { SavedAttachment } from "../../attachments/attachment-files.js";
import { withAttachmentNote } from "../../attachments/attachment-note.js";
import type { Input } from "./inputs.js";

/** Where your spoken messages go once they may: the operator's loop. */
export interface InputSink {
  enqueue(input: Input): void;
}

/** A spoken message waiting while a page asks whether the files in its draft go with it. */
export interface HeldVoiceMessage {
  id: string;
  text: string;
}

/**
 * Your spoken messages on their way to the operator. While an open page has files in its draft, one waits for you to
 * choose whether they go with it. It never waits longer than `waitMs`, and what you say meanwhile joins it.
 */
export class VoiceHold {
  /** Attached files waiting in each open page's draft, by page. */
  private drafts = new Map<string, number>();
  private held?: HeldVoiceMessage;
  private timer?: NodeJS.Timeout;
  private lastId = 0;

  constructor(
    private loop: InputSink,
    private waitMs: number,
  ) {}

  get waiting(): HeldVoiceMessage | undefined {
    return this.held && { ...this.held };
  }

  receive(text: string): void {
    if (this.held) this.held.text = `${this.held.text} ${text}`;
    else if (this.drafts.size) this.hold(text);
    else this.send(text);
  }

  /** A page's draft now has `files` attached files; once no draft has any, a waiting message goes on its own. */
  draftChanged(page: string, files: number): void {
    if (files) this.drafts.set(page, files);
    else this.drafts.delete(page);
    if (!this.drafts.size && this.held) this.sendAlone(this.held.id);
  }

  sendWithFiles(id: string, files: SavedAttachment[]): void {
    this.send(withAttachmentNote(this.take(id).text, files));
  }

  sendAlone(id: string): void {
    this.send(this.take(id).text);
  }

  /** The waiting message is dropped unsent; the files stay in the draft. */
  discard(id: string): void {
    this.take(id);
  }

  private hold(text: string): void {
    const id = String(++this.lastId);
    this.held = { id, text };
    this.timer = setTimeout(() => this.sendAlone(id), this.waitMs);
    this.timer.unref();
  }

  private take(id: string): HeldVoiceMessage {
    const held = this.held;
    if (held?.id !== id)
      throw new Error("That voice message was already sent without the files; they stay in the draft.");
    clearTimeout(this.timer);
    this.held = undefined;
    return held;
  }

  private send(text: string): void {
    this.loop.enqueue({ kind: "user", text, source: "voice" });
  }
}
