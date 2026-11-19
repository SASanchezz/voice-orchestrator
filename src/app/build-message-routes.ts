import type { MessagesSettings } from "../config/messages-config.js";
import { ChatBrowsers, type ChatBrowser } from "../messages/browse/chat-browsers.js";
import { ChatFiles } from "../messages/browse/chat-files.js";
import { MessageTasks } from "../messages/browse/message-tasks.js";
import { SlackChatBrowser } from "../messages/browse/slack-chat-browser.js";
import { TelegramChatBrowser } from "../messages/browse/telegram-chat-browser.js";
import { ChatBrowseRoutes, type ChatBrowsing } from "../ui/server/chat-browse-routes.js";
import { ChatSendActions } from "../ui/server/chat-send-actions.js";
import type { GetRouteGroup } from "../ui/server/get-routes.js";
import { ReplyReadRoutes, type ReplyReads } from "../ui/server/reply-read-routes.js";
import { SavedFileRoute } from "../ui/server/saved-file-route.js";
import type { UiAccess } from "../ui/server/ui-access.js";
import type { MessengerLinks } from "./build-messages.js";
import type { Core } from "./core.js";

/** All chats: what it reads, and the Send button that writes what you typed. */
export interface ChatParts {
  browsing: ChatBrowsing;
  sends: ChatSendActions;
}

/** Every Slack workspace and Telegram in config; messages' files go into the app's attachments folder. */
export function buildChats(core: Core): ChatParts {
  const browsers = chatBrowsers(core.cfg.messages, core.messengers);
  const files = new ChatFiles(browsers, core.attachments);
  return {
    browsing: { browsers, files, tasks: new MessageTasks(browsers, files) },
    sends: new ChatSendActions(browsers),
  };
}

/** The Messages view's reads: drafted replies, All chats, and the message files it downloaded. */
export function messageViewRoutes(access: UiAccess, replies: ReplyReads, { browsing }: ChatParts): GetRouteGroup[] {
  const files = new SavedFileRoute(access, browsing.files);
  return [new ReplyReadRoutes(access, replies), new ChatBrowseRoutes(access, browsing), files];
}

/** By source key as drafts are ("slack:acme", "telegram"). */
function chatBrowsers(settings: MessagesSettings, links: MessengerLinks): ChatBrowsers {
  const entries = settings.slack.map((workspace): [string, ChatBrowser] => [
    `slack:${workspace.workspace}`,
    new SlackChatBrowser(workspace, links.openSlack),
  ]);
  if (settings.telegram) entries.push(["telegram", new TelegramChatBrowser(settings.telegram, links.openTelegram)]);
  return new ChatBrowsers(new Map(entries));
}
