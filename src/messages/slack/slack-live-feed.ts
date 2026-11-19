import type { SlackWorkspaceSettings } from "../../config/messages-config.js";
import type { InboundFeed, InboundSink } from "../replies/inbound.js";
import { conversationsToRead } from "./slack-conversations.js";
import { SlackEvents } from "./slack-events.js";
import type { UserNameCache } from "./slack-names.js";
import type { OpenSlack } from "./slack-reader.js";
import type { SlackSocket, SocketListener } from "./slack-socket.js";
import { openWorkspace } from "./slack-workspace.js";

/** How a feed reaches Slack: the Web API with the user token, and the live connection with the app-level one. */
export interface SlackConnections {
  openSlack: OpenSlack;
  socketFor(workspace: string, listener: SocketListener): SlackSocket;
}

/** One workspace's new messages, pushed through Socket Mode as they arrive. */
export class SlackLiveFeed implements InboundFeed {
  readonly name: string;
  private userNames: UserNameCache = new Map();

  constructor(
    private settings: SlackWorkspaceSettings,
    private connections: SlackConnections,
    private sink: InboundSink,
  ) {
    this.name = `Slack ${settings.workspace}`;
  }

  async start(): Promise<void> {
    const { workspace: name, channels } = this.settings;
    const workspace = await openWorkspace(this.connections.openSlack, name, this.userNames);
    const events = new SlackEvents(name, workspace, this.sink);
    events.readFrom(await conversationsToRead(workspace.client, channels));
    await this.connections.socketFor(name, events).start();
    console.log(`[replies] ${this.name}: listening for new messages`);
  }
}
