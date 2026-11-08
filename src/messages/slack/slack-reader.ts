import type { SlackWorkspaceSettings } from "../../config/messages-config.js";
import type { SourceCursor } from "../cursors.js";
import type { MessageSource, SourceReading } from "../message-types.js";
import type { SlackCalls } from "./slack-client.js";
import type { UserNameCache } from "./slack-names.js";
import { SlackReading } from "./slack-reading.js";
import { openWorkspace } from "./slack-workspace.js";

/** The Keychain service the workspace tokens are saved under, one account per workspace. */
export const SLACK_KEYCHAIN_SERVICE = "voice-orchestrator.slack";

/** The workspace's API with its token from the Keychain, opened for each catch-up. */
export type OpenSlack = (workspace: string) => Promise<SlackCalls>;

/** One Slack workspace: your DMs, group DMs and mentions, and the channels named in config. Only read methods are called. */
export class SlackReader implements MessageSource {
  readonly kind = "slack";
  readonly name: string;
  readonly profile: string;
  readonly cursorKey: string;
  private userNames: UserNameCache = new Map();

  constructor(
    private settings: SlackWorkspaceSettings,
    private open: OpenSlack,
    private now: () => Date = () => new Date(),
  ) {
    this.name = `Slack ${settings.workspace}`;
    this.profile = settings.profile;
    this.cursorKey = `slack:${settings.workspace}`;
  }

  describe(): string {
    const { channels, profile } = this.settings;
    const extra = channels.length ? `, plus channels ${channels.join(", ")}` : "";
    return `${this.name}: DMs, group DMs and mentions${extra}; summarized on the ${profile} account`;
  }

  async read(cursor: SourceCursor, chat?: string): Promise<SourceReading> {
    const workspace = await openWorkspace(this.open, this.settings.workspace, this.userNames);
    const reading = new SlackReading(workspace, cursor, this.now());
    const { channels } = this.settings;
    return chat ? reading.oneChat(channels, chat) : reading.everything(channels);
  }
}
