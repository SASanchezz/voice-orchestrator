import { z } from "zod";
import type { Draft } from "../replies/draft-store.js";
import type { ReplyChannel } from "../replies/reply-channel.js";
import type { SlackParams } from "./slack-client.js";
import type { OpenSlack } from "./slack-reader.js";

const postedSchema = z.object({ ts: z.string() });

/** Posts as you with the workspace's user token (chat:write), in the thread when the message was in one. */
export class SlackReplyChannel implements ReplyChannel {
  constructor(
    private workspace: string,
    private open: OpenSlack,
  ) {}

  async send({ chatId, threadId }: Draft, text: string): Promise<void> {
    const params: SlackParams = { channel: chatId, text };
    if (threadId) params.thread_ts = threadId;
    const client = await this.open(this.workspace);
    await client.call("chat.postMessage", params, postedSchema);
  }

  /** Slack has no public way to fill its own message box; the draft stays in the app. */
  async prefill(): Promise<void> {}

  async clearPrefill(): Promise<void> {}
}
