import type { SlackWorkspaceSettings } from "../config/messages-config.js";
import type { InboundFeed } from "../messages/replies/inbound.js";
import type { CountedInbox } from "../messages/replies/reply-health.js";
import { webSocketTo } from "../messages/slack/event-socket.js";
import { SLACK_EVENTS_KEYCHAIN_SERVICE, socketUrl } from "../messages/slack/slack-events-token.js";
import { SlackLiveFeed, type SlackConnections } from "../messages/slack/slack-live-feed.js";
import { SlackSocket, type SocketListener } from "../messages/slack/slack-socket.js";
import { keychainOnThisMac, type Keychain } from "../secrets/keychain.js";
import { sleep } from "../shared/sleep.js";
import type { MessengerLinks } from "./build-messages.js";

/** Each sending workspace's messages, pushed through Socket Mode with its app-level token. */
export function slackLiveFeeds(
  workspaces: SlackWorkspaceSettings[],
  links: MessengerLinks,
  inbox: CountedInbox,
): InboundFeed[] {
  const connections = slackConnections(links, keychainOnThisMac(), inbox);
  return workspaces.map((workspace) => new SlackLiveFeed(workspace, connections, inbox));
}

function slackConnections(links: MessengerLinks, keychain: Keychain, inbox: CountedInbox): SlackConnections {
  const times = { wait: sleep, now: () => new Date() };
  const open = (workspace: string) => async () => webSocketTo(await eventsAddress(keychain, workspace));
  return {
    openSlack: links.openSlack,
    socketFor: (workspace, listener) => new SlackSocket(open(workspace), counted(listener, inbox, workspace), times),
  };
}

/** Every pushed event is counted for the setup checkup before it is looked at. */
function counted(listener: SocketListener, inbox: CountedInbox, workspace: string): SocketListener {
  return {
    heard: (event) => {
      inbox.heard(`Slack ${workspace}`);
      listener.heard(event);
    },
    reconnected: (downSince) => listener.reconnected(downSince),
  };
}

/** The app-level token is read fresh for each connection, so a replaced one works without a restart. */
async function eventsAddress(keychain: Keychain, workspace: string): Promise<string> {
  if (!(await keychain.has(SLACK_EVENTS_KEYCHAIN_SERVICE, workspace)))
    throw new Error(`no app-level token is saved for ${workspace}: run npm run slack-events-login -- ${workspace}`);
  return socketUrl(await keychain.read(SLACK_EVENTS_KEYCHAIN_SERVICE, workspace), fetch);
}
