import type { MessagesSettings, SlackWorkspaceSettings, TelegramSettings } from "../../config/messages-config.js";
import type { SetupCheck, SourceCheckup } from "../../ui/reply-checkup-views.js";
import { liveChecks, sendCheck } from "./live-checks.js";
import type { ReplyHealth } from "./reply-health.js";

/** A working connection can still bring nothing, when the app's user events aren't set or the tokens differ. */
const SLACK_QUIET =
  "Ask someone to DM you: your own messages are skipped. If theirs don't arrive, open the app named under Live " +
  "connection at api.slack.com/apps: Event Subscriptions › Subscribe to events on behalf of users needs " +
  "message.im and message.mpim, and the user token must come from that same app. Then Reinstall to Workspace " +
  "and log in again.";
const TELEGRAM_QUIET =
  "Ask someone to write to you in a private chat: your own messages and Saved Messages are skipped.";

/** Each messenger's checks with the messenger, tried now. */
export interface SetupProbes {
  slack: { check(settings: SlackWorkspaceSettings): Promise<SetupCheck[]> };
  telegram: { check(): Promise<SetupCheck[]> };
}

/** For every messenger in the config: can replies work, and what has the live feed done since the app started. */
export class ReplyCheckup {
  constructor(
    private settings: MessagesSettings,
    private probes: SetupProbes,
    private health: ReplyHealth,
  ) {}

  async run(): Promise<SourceCheckup[]> {
    const slack = await Promise.all(this.settings.slack.map(async (workspace) => this.slack(workspace)));
    const telegram = this.settings.telegram ? [await this.telegram(this.settings.telegram)] : [];
    return [...slack, ...telegram];
  }

  private async slack(settings: SlackWorkspaceSettings): Promise<SourceCheckup> {
    const source = `Slack ${settings.workspace}`;
    const place = `under the workspace "${settings.workspace}" in messages.slack`;
    const live = settings.send ? liveChecks(this.health.of(source), SLACK_QUIET) : [];
    return { source, checks: [sendCheck(settings.send, place), ...(await this.probes.slack.check(settings)), ...live] };
  }

  private async telegram(settings: TelegramSettings): Promise<SourceCheckup> {
    const source = "Telegram";
    const live = settings.send ? liveChecks(this.health.of(source), TELEGRAM_QUIET) : [];
    const signedIn = await this.probes.telegram.check();
    return { source, checks: [sendCheck(settings.send, "under messages.telegram"), ...signedIn, ...live] };
  }
}
