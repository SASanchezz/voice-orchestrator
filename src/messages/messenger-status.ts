import type { MessagesSettings } from "../config/messages-config.js";
import type { Keychain } from "../secrets/keychain.js";
import type { MessengerStatusView } from "../ui/messenger-status-views.js";
import { SLACK_KEYCHAIN_SERVICE } from "./slack/slack-reader.js";
import type { TelegramCheck, TelegramCheckOutcome } from "./telegram/telegram-check.js";
import { KEYCHAIN_ACCOUNTS, TELEGRAM_KEYCHAIN_SERVICE } from "./telegram/telegram-keychain.js";

const CONNECTED_HINT = 'In config.yaml and logged in. "Catch me up on my messages" shows it reads.';

const SLACK_OFF: MessengerStatusView = {
  name: "Slack",
  state: "off",
  hint: "Not set up: no workspace under messages in config.yaml.",
};

const TELEGRAM = "Telegram";
const TELEGRAM_CONNECTED: MessengerStatusView = {
  name: TELEGRAM,
  state: "connected",
  hint: "Telegram accepted the login when the app started.",
};
const TELEGRAM_CHECKING: MessengerStatusView = {
  name: TELEGRAM,
  state: "checking",
  hint: "Logged in; asking Telegram whether the login still works.",
};
const TELEGRAM_OFF: MessengerStatusView = { name: TELEGRAM, state: "off", hint: "Not set up." };
const TELEGRAM_NOT_LOGGED_IN: MessengerStatusView = {
  name: TELEGRAM,
  state: "half",
  hint: "In config.yaml, but not logged in: run npm run telegram-login",
};
const TELEGRAM_NOT_IN_CONFIG: MessengerStatusView = {
  name: TELEGRAM,
  state: "half",
  hint: "Logged in, but not under messages in config.yaml: add it there, then restart.",
};

/**
 * Whether each messenger is in the config the app runs with and has its login in the Keychain. Slack's login is
 * only checked to be there; Telegram's was also tried once with Telegram when the app started.
 */
export class MessengerStatus {
  constructor(
    private settings: MessagesSettings,
    private keychain: Keychain,
    private telegramCheck: TelegramCheck,
  ) {}

  async all(): Promise<MessengerStatusView[]> {
    const slack = await this.slackWorkspaces();
    return [...slack, await this.telegram()];
  }

  private async slackWorkspaces(): Promise<MessengerStatusView[]> {
    if (!this.settings.slack.length) return [SLACK_OFF];
    return Promise.all(this.settings.slack.map(async ({ workspace }) => this.slackWorkspace(workspace)));
  }

  private async slackWorkspace(workspace: string): Promise<MessengerStatusView> {
    const name = `Slack ${workspace}`;
    const loggedIn = await this.keychain.has(SLACK_KEYCHAIN_SERVICE, workspace);
    if (loggedIn) return { name, state: "connected", hint: CONNECTED_HINT };
    return { name, state: "half", hint: `In config.yaml, but not logged in: run npm run slack-login -- ${workspace}` };
  }

  private async telegram(): Promise<MessengerStatusView> {
    const loggedIn = await this.keychain.has(TELEGRAM_KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNTS.session);
    if (!this.settings.telegram) return loggedIn ? TELEGRAM_NOT_IN_CONFIG : TELEGRAM_OFF;
    return loggedIn ? telegramView(this.telegramCheck.result()) : TELEGRAM_NOT_LOGGED_IN;
  }
}

function telegramView(outcome: TelegramCheckOutcome): MessengerStatusView {
  if (outcome.state === "checking") return TELEGRAM_CHECKING;
  if (outcome.state === "connected") return TELEGRAM_CONNECTED;
  return { name: TELEGRAM, state: "failed", hint: `Telegram didn't accept the login at startup: ${outcome.reason}` };
}
