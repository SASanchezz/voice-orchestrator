import { resolve } from "node:path";
import type { QueryFn } from "../agent/query-fn.js";
import type { AppConfig } from "../config/app-config.js";
import type { MessagesSettings } from "../config/messages-config.js";
import { STATE_DIR } from "../config/paths.js";
import { MessageCatchUp } from "../messages/catch-up.js";
import { MessageCursors } from "../messages/cursors.js";
import { MessageDigest } from "../messages/message-digest.js";
import type { MessageReading } from "../messages/message-reading.js";
import { MessengerStatus } from "../messages/messenger-status.js";
import type { MessageSource } from "../messages/message-types.js";
import { CountsLog } from "../messages/reading-log.js";
import { SourceCatchUp } from "../messages/source-catch-up.js";
import { SlackClient } from "../messages/slack/slack-client.js";
import { SLACK_KEYCHAIN_SERVICE, SlackReader, type OpenSlack } from "../messages/slack/slack-reader.js";
import type { OpenTelegram } from "../messages/telegram/telegram-port.js";
import { TelegramCheck } from "../messages/telegram/telegram-check.js";
import { SharedTelegram } from "../messages/telegram/shared-telegram.js";
import { TelegramSource } from "../messages/telegram/telegram-source.js";
import { keychainOnThisMac, type Keychain } from "../secrets/keychain.js";
import { sleep } from "../shared/sleep.js";

/** How the app opens Slack and Telegram: one Telegram connection, shared by catch-ups, the check and the watch. */
export interface MessengerLinks {
  openSlack: OpenSlack;
  openTelegram: OpenTelegram;
}

/** Nothing connects until something first opens a messenger. */
export function messengerLinks(): MessengerLinks {
  const keychain = keychainOnThisMac();
  return { openSlack: slackWith(keychain), openTelegram: new SharedTelegram(telegramWith(keychain)).open };
}

/** Slack and Telegram reading for the assistant's tools; with no messages block, the tools say it is off. */
export function buildMessages(cfg: AppConfig, query: QueryFn, links: MessengerLinks): MessageReading {
  const sources = messageSources(cfg.messages, links);
  const cursors = new MessageCursors(resolve(STATE_DIR, "messages", "cursors.json"));
  const sourceCatchUp = new SourceCatchUp(new MessageDigest(cfg, query), cursors, new CountsLog());
  return new MessageCatchUp(sources, sourceCatchUp);
}

function messageSources(settings: MessagesSettings, links: MessengerLinks): MessageSource[] {
  const slack = settings.slack.map((workspace) => new SlackReader(workspace, links.openSlack));
  const telegram = settings.telegram ? [new TelegramSource(settings.telegram, links.openTelegram, sleep)] : [];
  return [...slack, ...telegram];
}

/** Each catch-up reads the workspace's token fresh, so a replaced token works without a restart. */
function slackWith(keychain: Keychain): OpenSlack {
  return async (workspace) => new SlackClient(await slackToken(keychain, workspace), fetch, sleep);
}

async function slackToken(keychain: Keychain, workspace: string): Promise<string> {
  if (!(await keychain.has(SLACK_KEYCHAIN_SERVICE, workspace)))
    throw new Error(`no Slack token is saved for ${workspace}: run npm run slack-login -- ${workspace}`);
  return keychain.read(SLACK_KEYCHAIN_SERVICE, workspace);
}

/** Which messengers are connected, for ⚙ › Messengers; Telegram is asked once, now, when it is in the config. */
export function buildMessengerStatus(cfg: AppConfig, links: MessengerLinks): MessengerStatus {
  const telegramCheck = new TelegramCheck(links.openTelegram);
  if (cfg.messages.telegram) telegramCheck.start();
  return new MessengerStatus(cfg.messages, keychainOnThisMac(), telegramCheck);
}

/** GramJS is loaded only when Telegram is first read. */
function telegramWith(keychain: Keychain): OpenTelegram {
  return async () => {
    const { openTelegram } = await import("../messages/telegram/telegram-reader.js");
    return openTelegram(keychain);
  };
}
