import type { SlackWorkspaceSettings } from "../../config/messages-config.js";
import { errorMessage } from "../../shared/errors.js";
import { sleep } from "../../shared/sleep.js";
import type { ArrivalSink, MessageWatch } from "../alerts/arrivals.js";
import { logWatched } from "../alerts/watched-names.js";
import type { UserNameCache } from "./slack-names.js";
import { SlackNewMessages } from "./slack-new-messages.js";
import type { OpenSlack } from "./slack-reader.js";
import { namesOf, watchedConversations } from "./slack-watched.js";
import { openWorkspace } from "./slack-workspace.js";

/** A user token can't get Slack's pushed events, so watched conversations are asked about once a minute. */
const CHECK_EVERY_MS = 60_000;

/**
 * One workspace's conversations under `notify`, matched once, at start, among those the catch-up reads.
 * One conversations.history call per watched conversation a minute stays far inside Slack's rate limits.
 */
export class SlackWatch implements MessageWatch {
  readonly name: string;
  private userNames: UserNameCache = new Map();
  private lastFailure = "";

  constructor(
    private settings: SlackWorkspaceSettings,
    private open: OpenSlack,
    private alerts: ArrivalSink,
  ) {
    this.name = `Slack ${settings.workspace}`;
  }

  async start(): Promise<void> {
    const workspace = await openWorkspace(this.open, this.settings.workspace, this.userNames);
    const watched = await watchedConversations(workspace, this.settings);
    logWatched(this.name, namesOf(watched), this.settings.notify);
    if (!watched.length) return;
    const heard = (chat: string, from: string) => this.alerts.heard({ source: this.name, chat, from });
    void this.checkEveryMinute(new SlackNewMessages(workspace, watched, heard));
  }

  private async checkEveryMinute(newMessages: SlackNewMessages): Promise<void> {
    for (;;) {
      await this.checkOrLog(newMessages);
      await sleep(CHECK_EVERY_MS);
    }
  }

  /** A failed check is tried again next minute; the same failure is logged only once in a row. */
  private async checkOrLog(newMessages: SlackNewMessages): Promise<void> {
    try {
      await newMessages.check();
      this.lastFailure = "";
    } catch (error) {
      this.logFailure(errorMessage(error));
    }
  }

  private logFailure(failure: string): void {
    if (failure !== this.lastFailure)
      console.warn(`[messages] ${this.name}: checking for new messages failed: ${failure}`);
    this.lastFailure = failure;
  }
}
