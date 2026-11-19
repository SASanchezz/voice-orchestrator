import type { SlackWorkspaceSettings } from "../../config/messages-config.js";

/**
 * Read-only user scopes for DMs, group DMs, channels, shared files, names and mention search. Channels are always readable, so the
 * Messages view's All chats can show every conversation you are in.
 */
const READ_SCOPES = [
  "im:read",
  "im:history",
  "mpim:read",
  "mpim:history",
  "channels:read",
  "channels:history",
  "groups:read",
  "groups:history",
  "users:read",
  "search:read",
  "files:read",
];
/** Posts as you; only asked for when the workspace has `send: true`. */
const SEND_SCOPES = ["chat:write"];
/** Pushed to the app through Socket Mode, on your behalf, as messages arrive. */
const DIRECT_EVENTS = ["message.im", "message.mpim"];
const CHANNEL_EVENTS = ["message.channels", "message.groups"];
const NEW_APP_URL = "https://api.slack.com/apps";

/** The Slack app a workspace needs: its name, what it says it does, its user scopes and the user events it gets. */
export interface SlackApp {
  name: string;
  description: string;
  scopes: string[];
  userEvents: string[];
}

/** The app for the workspace's settings: read-only, or replying with real-time events when it sends. */
export function appFor({ channels, send }: Pick<SlackWorkspaceSettings, "channels" | "send">): SlackApp {
  return send ? replyingApp(channels) : readOnlyApp();
}

/** Reads every conversation you are in; never writes. */
export function readOnlyApp(): SlackApp {
  return {
    name: "Voice Orchestrator (read-only)",
    description: "Reads your messages for spoken summaries. Never writes.",
    scopes: READ_SCOPES,
    userEvents: [],
  };
}

/** Reads, gets new messages pushed as they arrive, and sends the replies you approve. */
export function replyingApp(channelNames: string[]): SlackApp {
  const channelEvents = channelNames.length ? CHANNEL_EVENTS : [];
  return {
    name: "Voice Orchestrator",
    description: "Reads your messages, drafts replies, and sends only the ones you approve.",
    scopes: [...READ_SCOPES, ...SEND_SCOPES],
    userEvents: [...DIRECT_EVENTS, ...channelEvents],
  };
}

/** Opens Slack's "create app" page with the app's manifest already filled in: an internal app with user scopes only. */
export function newAppLink(app: SlackApp): string {
  const manifest = {
    display_information: { name: app.name, description: app.description },
    oauth_config: { scopes: { user: app.scopes } },
    settings: { ...eventSettings(app.userEvents), org_deploy_enabled: false, token_rotation_enabled: false },
  };
  const query = new URLSearchParams({ new_app: "1", manifest_json: JSON.stringify(manifest) });
  return `${NEW_APP_URL}?${query.toString()}`;
}

/** Socket Mode carries the user events, so no public URL or bot user is needed. */
function eventSettings(userEvents: string[]): object {
  if (!userEvents.length) return { socket_mode_enabled: false };
  return { socket_mode_enabled: true, event_subscriptions: { user_events: userEvents } };
}
