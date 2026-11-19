import { z } from "zod";
import type { SlackWorkspaceSettings } from "../../config/messages-config.js";
import type { BrowsedChatView, BrowsedMessageView } from "../../ui/chat-browse-views.js";
import { isSaidBySomeone, messagesAfter } from "../slack/slack-history.js";
import type { UserNameCache } from "../slack/slack-names.js";
import type { OpenSlack } from "../slack/slack-reader.js";
import { openWorkspace, type SlackWorkspace } from "../slack/slack-workspace.js";
import { SHOWN_MESSAGES, type ChatBrowser } from "./chat-browsers.js";
import { slackMessageView } from "./slack-message-views.js";
import { listYourChats } from "./slack-your-chats.js";

const FROM_THE_START = "0";
const postedSchema = z.object({ ts: z.string() });
const fileInfoSchema = z.object({ file: z.object({ url_private_download: z.string() }) });

/** Every conversation you are in; without the channel read scopes, only your DMs and group DMs. */
export class SlackChatBrowser implements ChatBrowser {
  readonly label: string;
  readonly sendHint: string;
  private userNames: UserNameCache = new Map();

  constructor(
    private settings: SlackWorkspaceSettings,
    private open: OpenSlack,
  ) {
    this.label = `Slack ${settings.workspace}`;
    this.sendHint = settings.send ? "" : `To write here, add send: true to ${this.label} in config and log in again.`;
  }

  /** The first listing learns everyone's name at once, so DMs aren't named one users.info call at a time. */
  async listChats(): Promise<BrowsedChatView[]> {
    const workspace = await this.openWorkspace();
    if (!this.userNames.size) await workspace.names.learnEveryone();
    return listYourChats(workspace.client, workspace.names);
  }

  async readChat(chatId: string): Promise<BrowsedMessageView[]> {
    const workspace = await this.openWorkspace();
    const window = { oldest: FROM_THE_START, limit: SHOWN_MESSAGES };
    const newestFirst = await messagesAfter(workspace.client, chatId, window);
    const said = newestFirst.filter(isSaidBySomeone).toReversed();
    return Promise.all(said.map((message) => slackMessageView(message, workspace)));
  }

  /** The file's download link is asked for afresh (files.info), so it is never handed to the page. */
  async downloadFile(_chatId: string, _messageId: string, fileId: string): Promise<Buffer> {
    const client = await this.open(this.settings.workspace);
    const { file } = await client.call("files.info", { file: fileId }, fileInfoSchema);
    return client.download(file.url_private_download);
  }

  /** Posts as you (chat:write), which the workspace has only with send: true. */
  async send(chatId: string, text: string): Promise<void> {
    if (this.sendHint) throw new Error(this.sendHint);
    const client = await this.open(this.settings.workspace);
    await client.call("chat.postMessage", { channel: chatId, text }, postedSchema);
  }

  private openWorkspace(): Promise<SlackWorkspace> {
    return openWorkspace(this.open, this.settings.workspace, this.userNames);
  }
}
