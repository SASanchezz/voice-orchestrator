import type { MessagesSettings, TelegramSettings } from "../config/messages-config.js";
import type { ArrivalSink, MessageWatch } from "../messages/alerts/arrivals.js";
import { MessageWatches } from "../messages/alerts/message-watches.js";
import { NewMessageAlerts, type Announcer } from "../messages/alerts/new-message-alerts.js";
import { SlackWatch } from "../messages/slack/slack-watch.js";
import { TelegramWatch } from "../messages/telegram/telegram-watch.js";
import { sleep } from "../shared/sleep.js";
import type { MessengerLinks } from "./build-messages.js";

/** A watch for each source with chats under `notify`; with none, nothing runs in the background. */
export function buildMessageAlerts(
  settings: MessagesSettings,
  links: MessengerLinks,
  announcer: Announcer,
): MessageWatches {
  const alerts = new NewMessageAlerts(announcer, sleep);
  const slack = settings.slack.filter(hasNotify).map((workspace) => new SlackWatch(workspace, links.openSlack, alerts));
  return new MessageWatches([...slack, ...telegramWatches(settings.telegram, links, alerts)]);
}

function telegramWatches(
  telegram: TelegramSettings | undefined,
  links: MessengerLinks,
  alerts: ArrivalSink,
): MessageWatch[] {
  if (!telegram || !hasNotify(telegram)) return [];
  return [new TelegramWatch(telegram, links.openTelegram, alerts)];
}

function hasNotify(source: { notify: string[] }): boolean {
  return source.notify.length > 0;
}
