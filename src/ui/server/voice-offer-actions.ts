import type { SavedAttachment } from "../../attachments/attachment-files.js";
import type { VoiceHold } from "../../orchestrator/conversation/voice-hold.js";
import { draftBody } from "./request-body.js";

/** Your choice, from the page, whether the files in its draft go with your voice message. */
export class VoiceOfferActions {
  constructor(private hold: VoiceHold) {}

  /** Each page says how many files its draft has, so a voice message waits only while one has some. */
  draftChanged(body: unknown): string {
    const { page, files } = draftBody.parse(body);
    this.hold.draftChanged(page, files);
    return "Noted.";
  }

  sendWithFiles(id: string, files: SavedAttachment[]): string {
    this.hold.sendWithFiles(id, files);
    return "Sent with your voice message.";
  }

  keepInDraft(id: string): string {
    this.hold.sendAlone(id);
    return "Voice message sent; the files stay in the draft.";
  }
}
