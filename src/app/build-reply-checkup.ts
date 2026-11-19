import type { MessagesSettings } from "../config/messages-config.js";
import { ReplyCheckup } from "../messages/replies/reply-checkup.js";
import type { ReplyHealth } from "../messages/replies/reply-health.js";
import { webSocketTo } from "../messages/slack/event-socket.js";
import { SlackSetupCheck } from "../messages/slack/slack-setup-check.js";
import { TelegramSetupCheck } from "../messages/telegram/telegram-setup-check.js";
import { keychainOnThisMac } from "../secrets/keychain.js";
import type { MessengerLinks } from "./build-messages.js";

/** The Messages view's Check setup: every messenger in the config, tried now, with what its feed did since the start. */
export function replyCheckup(settings: MessagesSettings, links: MessengerLinks, health: ReplyHealth): ReplyCheckup {
  const slack = new SlackSetupCheck(keychainOnThisMac(), fetch, webSocketTo);
  return new ReplyCheckup(settings, { slack, telegram: new TelegramSetupCheck(links.openTelegram) }, health);
}
