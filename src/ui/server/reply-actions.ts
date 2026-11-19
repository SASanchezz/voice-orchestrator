import { z } from "zod";
import type { ReplyDesk } from "../../messages/replies/reply-desk.js";
import { MAX_REPLY_CHARS } from "../../messages/replies/sendable-reply.js";
import type { SpokenSend } from "../../messages/replies/spoken-send.js";

/** The reply as the page shows it, kept exactly as it is: what you approve is what is sent. */
const replyTextBody = z.object({ text: z.string().min(1).max(MAX_REPLY_CHARS) });

/** The page's buttons on a drafted reply, and the draft it marks as in front of you for "confirm send". */
export class ReplyActions {
  constructor(
    private desk: ReplyDesk,
    private spoken: SpokenSend,
  ) {}

  async edit(id: string, body: unknown): Promise<string> {
    const { text } = replyTextBody.parse(body);
    await this.desk.edit(id, text);
    this.spoken.arm(id, text);
    return "Draft saved.";
  }

  /** The click is the approval of the text it carries. */
  async send(id: string, body: unknown): Promise<string> {
    this.spoken.disarm(id);
    const sent = await this.desk.send(id, replyTextBody.parse(body).text);
    return `Sent to ${sent.chatName}.`;
  }

  async dismiss(id: string): Promise<string> {
    this.spoken.disarm(id);
    await this.desk.dismiss(id);
    return "Draft dismissed.";
  }

  arm(id: string, body: unknown): string {
    this.spoken.arm(id, replyTextBody.parse(body).text);
    return 'Say "confirm send" to send it.';
  }
}
