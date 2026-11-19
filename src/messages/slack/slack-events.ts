import { errorMessage } from "../../shared/errors.js";
import type { InboundSink } from "../replies/inbound.js";
import type { SlackConversation } from "./slack-conversations.js";
import { personMessageOf, type PersonMessage } from "./slack-message-event.js";
import { missedMessages } from "./slack-missed.js";
import type { SocketListener } from "./slack-socket.js";
import type { SlackWorkspace } from "./slack-workspace.js";

/** Slack redelivers unacknowledged events after a short drop; only a longer one is caught up from history. */
const CATCH_UP_AFTER_MS = 60_000;

/**
 * Turns one workspace's pushed events into inbox messages: only from people, only in the conversations the
 * catch-up reads (DMs, group DMs and the channels named in config), never your own.
 */
export class SlackEvents implements SocketListener {
  private readonly source: string;
  private readonly sourceKey: string;
  private conversations: SlackConversation[] = [];

  constructor(
    workspaceName: string,
    private workspace: SlackWorkspace,
    private sink: InboundSink,
  ) {
    this.source = `Slack ${workspaceName}`;
    this.sourceKey = `slack:${workspaceName}`;
  }

  /** The conversations read; until they are given, only DMs and group DMs pass. */
  readFrom(conversations: SlackConversation[]): void {
    this.conversations = conversations;
  }

  heard(event: unknown): void {
    const message = personMessageOf(event);
    if (message && this.isRead(message)) this.passOrLog(message);
  }

  reconnected(downSince: Date): void {
    if (Date.now() - downSince.getTime() < CATCH_UP_AFTER_MS) return;
    missedMessages(this.workspace, this.conversations, downSince)
      .then((missed) => missed.forEach((message) => this.passOrLog(message)))
      .catch((error: unknown) => this.logLost(error));
  }

  private isRead(message: PersonMessage): boolean {
    if (message.user === this.workspace.me) return false;
    return message.chatKind !== "group" || this.conversations.some((read) => read.id === message.chatId);
  }

  private passOrLog(message: PersonMessage): void {
    this.pass(message).catch((error: unknown) => this.logLost(error));
  }

  private async pass({ chatId, chatKind, user, ts, threadTs }: PersonMessage): Promise<void> {
    const from = await this.workspace.names.userName(user);
    const chat = { sourceKey: this.sourceKey, source: this.source, chatId, chatKind };
    this.sink.received({ ...chat, from, messageId: ts, threadId: threadTs });
  }

  private logLost(error: unknown): void {
    console.warn(`[replies] ${this.source}: a new message was lost: ${errorMessage(error)}`);
  }
}
